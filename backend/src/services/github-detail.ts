import type {
  Connection,
  GitHubIssueDetails,
  GitHubPRDetails,
  DetailComment,
} from '../types';
import { InsufficientScopeError } from '../types';

const GH_API = 'https://api.github.com';

interface GitHubComment {
  id: number;
  user: { login: string; avatar_url: string } | null;
  body_html: string;
  created_at: string;
}

interface GitHubRepoPermissions {
  permissions?: { push?: boolean; admin?: boolean; maintain?: boolean };
}

const MAX_COMMENTS = 20;

function htmlHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.html+json',
    'User-Agent': 'noti-peek',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function jsonHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'noti-peek',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function throwForStatus(status: number, url: string): never {
  if (status === 401) throw new Error('GitHub token expired or revoked');
  if (status === 403) throw new InsufficientScopeError(`GitHub forbade ${url}`, 'github');
  if (status === 404) throw new Error(`GitHub not found: ${url}`);
  throw new Error(`GitHub API error ${status}: ${url}`);
}

async function fetchRepoPermissions(
  connection: Connection,
  owner: string,
  repo: string,
): Promise<{ push: boolean }> {
  const url = `${GH_API}/repos/${owner}/${repo}`;
  const res = await fetch(url, { headers: htmlHeaders(connection.access_token) });
  if (!res.ok) throwForStatus(res.status, url);
  const data = (await res.json()) as GitHubRepoPermissions;
  return { push: Boolean(data.permissions?.push || data.permissions?.maintain || data.permissions?.admin) };
}

function mapComments(raw: GitHubComment[]): DetailComment[] {
  return raw.map((c) => ({
    id: String(c.id),
    author: {
      name: c.user?.login ?? 'unknown',
      avatar: c.user?.avatar_url,
    },
    bodyHtml: c.body_html ?? '',
    createdAt: c.created_at,
  }));
}

export async function fetchIssueDetails(
  connection: Connection,
  owner: string,
  repo: string,
  number: number,
): Promise<GitHubIssueDetails> {
  const permissions = await fetchRepoPermissions(connection, owner, repo);

  const issueUrl = `${GH_API}/repos/${owner}/${repo}/issues/${number}`;
  const issueRes = await fetch(issueUrl, { headers: htmlHeaders(connection.access_token) });
  if (!issueRes.ok) throwForStatus(issueRes.status, issueUrl);
  const issue = (await issueRes.json()) as {
    number: number;
    state: 'open' | 'closed';
    state_reason: 'completed' | 'not_planned' | 'reopened' | null;
    title: string;
    body_html: string | null;
    user: { login: string; avatar_url: string } | null;
    labels: Array<{ name: string; color: string }>;
    assignees: Array<{ login: string; avatar_url: string }>;
    comments: number;
  };

  const commentsUrl = `${GH_API}/repos/${owner}/${repo}/issues/${number}/comments?per_page=${MAX_COMMENTS}`;
  const commentsRes = await fetch(commentsUrl, { headers: htmlHeaders(connection.access_token) });
  if (!commentsRes.ok) throwForStatus(commentsRes.status, commentsUrl);
  const rawComments = (await commentsRes.json()) as GitHubComment[];

  return {
    kind: 'github_issue',
    number: issue.number,
    state: issue.state,
    stateReason: issue.state_reason,
    title: issue.title,
    bodyHtml: issue.body_html ?? '',
    author: {
      login: issue.user?.login ?? 'unknown',
      avatar: issue.user?.avatar_url ?? '',
    },
    labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
    assignees: issue.assignees.map((a) => ({ login: a.login, avatar: a.avatar_url })),
    comments: mapComments(rawComments),
    commentCount: issue.comments,
    permissions: {
      canComment: true,
      canClose: permissions.push,
    },
  };
}

interface GitHubReview {
  user?: { login: string } | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  submitted_at: string | null;
}

interface GitHubCheckRun {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}

function computeReviewDecision(reviews: GitHubReview[]): 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null {
  if (reviews.length === 0) return null;
  const latestPerUser = new Map<string, GitHubReview>();
  for (const r of reviews) {
    if (r.state === 'COMMENTED' || r.state === 'PENDING' || r.state === 'DISMISSED') continue;
    const login = r.user?.login ?? 'unknown';
    const prev = latestPerUser.get(login);
    if (!prev || (r.submitted_at ?? '') > (prev.submitted_at ?? '')) {
      latestPerUser.set(login, r);
    }
  }
  const states = Array.from(latestPerUser.values()).map((r) => r.state);
  if (states.includes('CHANGES_REQUESTED')) return 'CHANGES_REQUESTED';
  if (states.includes('APPROVED')) return 'APPROVED';
  return 'REVIEW_REQUIRED';
}

function summarizeChecks(runs: GitHubCheckRun[]): { passed: number; failed: number; pending: number } {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  for (const r of runs) {
    if (r.status !== 'completed') {
      pending++;
    } else if (r.conclusion === 'success' || r.conclusion === 'skipped' || r.conclusion === 'neutral') {
      passed++;
    } else {
      failed++;
    }
  }
  return { passed, failed, pending };
}

export async function fetchPRDetails(
  connection: Connection,
  owner: string,
  repo: string,
  number: number,
): Promise<GitHubPRDetails> {
  const permissions = await fetchRepoPermissions(connection, owner, repo);

  const prUrl = `${GH_API}/repos/${owner}/${repo}/pulls/${number}`;
  const prRes = await fetch(prUrl, { headers: htmlHeaders(connection.access_token) });
  if (!prRes.ok) throwForStatus(prRes.status, prUrl);
  const pr = (await prRes.json()) as {
    number: number;
    state: 'open' | 'closed';
    state_reason: 'completed' | 'not_planned' | 'reopened' | null;
    title: string;
    body_html: string | null;
    user: { login: string; avatar_url: string } | null;
    labels: Array<{ name: string; color: string }>;
    assignees: Array<{ login: string; avatar_url: string }>;
    comments: number;
    draft: boolean;
    merged: boolean;
    mergeable: boolean | null;
    mergeable_state: string;
    head: { sha: string };
  };

  const commentsUrl = `${GH_API}/repos/${owner}/${repo}/issues/${number}/comments?per_page=${MAX_COMMENTS}`;
  const commentsRes = await fetch(commentsUrl, { headers: htmlHeaders(connection.access_token) });
  if (!commentsRes.ok) throwForStatus(commentsRes.status, commentsUrl);
  const rawComments = (await commentsRes.json()) as GitHubComment[];

  const reviewsUrl = `${GH_API}/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`;
  const reviewsRes = await fetch(reviewsUrl, { headers: htmlHeaders(connection.access_token) });
  if (!reviewsRes.ok) throwForStatus(reviewsRes.status, reviewsUrl);
  const reviews = (await reviewsRes.json()) as GitHubReview[];

  const checksUrl = `${GH_API}/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`;
  const checksRes = await fetch(checksUrl, { headers: htmlHeaders(connection.access_token) });
  if (!checksRes.ok) throwForStatus(checksRes.status, checksUrl);
  const checksData = (await checksRes.json()) as { check_runs: GitHubCheckRun[] };

  const reviewDecision = computeReviewDecision(reviews);
  const canMerge = permissions.push && pr.state === 'open' && !pr.merged && pr.mergeable === true && reviewDecision !== 'CHANGES_REQUESTED';

  return {
    kind: 'github_pr',
    number: pr.number,
    state: pr.state,
    stateReason: pr.state_reason,
    title: pr.title,
    bodyHtml: pr.body_html ?? '',
    author: { login: pr.user?.login ?? 'unknown', avatar: pr.user?.avatar_url ?? '' },
    labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
    assignees: pr.assignees.map((a) => ({ login: a.login, avatar: a.avatar_url })),
    comments: mapComments(rawComments),
    commentCount: pr.comments,
    draft: pr.draft,
    merged: pr.merged,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    reviewDecision,
    checks: summarizeChecks(checksData.check_runs),
    permissions: {
      canComment: true,
      canReview: true,
      canMerge,
      canClose: permissions.push,
    },
  };
}
