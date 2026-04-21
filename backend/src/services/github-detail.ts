import type {
  Connection,
  GitHubIssueDetails,
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
