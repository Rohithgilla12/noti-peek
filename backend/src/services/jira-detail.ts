import type {
  Connection,
  Env,
  JiraIssueDetails,
  JiraDetailUser,
  DetailComment,
} from '../types';
import { InsufficientScopeError, TokenExpiredError } from '../types';
import { refreshJiraToken } from './jira';

const URL_RE = /^https:\/\/[^/]+\/browse\/([A-Z][A-Z0-9_]*-\d+)/;

export function parseJiraIssueUrl(url: string): { key: string } | null {
  const match = URL_RE.exec(url);
  if (!match) return null;
  return { key: match[1] };
}

interface JiraResource {
  id: string;
  url: string;
  name: string;
}

function isTokenExpired(connection: Connection): boolean {
  if (!connection.token_expires_at) return false;
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const bufferMs = 5 * 60 * 1000;
  return expiresAt - bufferMs <= Date.now();
}

async function getAccessToken(connection: Connection, env: Env, db: D1Database): Promise<string> {
  if (isTokenExpired(connection)) {
    return refreshJiraToken(connection, env, db);
  }
  return connection.access_token;
}

async function getCloudId(token: string): Promise<{ cloudId: string; baseUrl: string }> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Jira accessible-resources error: ${res.status}`);
  const resources = (await res.json()) as JiraResource[];
  if (resources.length === 0) throw new Error('No Jira cloud resources available');
  return { cloudId: resources[0].id, baseUrl: resources[0].url };
}

function jiraHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

function throwForStatus(status: number, url: string): never {
  if (status === 401) throw new TokenExpiredError('Jira token expired or revoked');
  if (status === 403) throw new InsufficientScopeError(`Jira forbade ${url}`, 'jira');
  if (status === 404) throw new Error(`Jira not found: ${url}`);
  throw new Error(`Jira API error ${status}: ${url}`);
}

function mapJiraUser(u?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } } | null): JiraDetailUser | null {
  if (!u) return null;
  return {
    accountId: u.accountId,
    displayName: u.displayName,
    avatar: u.avatarUrls?.['48x48'],
  };
}

function mapStatusCategory(key: string): 'new' | 'indeterminate' | 'done' | 'unknown' {
  if (key === 'new' || key === 'indeterminate' || key === 'done') return key;
  return 'unknown';
}

export async function fetchJiraIssueDetails(
  connection: Connection,
  env: Env,
  db: D1Database,
  issueKey: string,
): Promise<JiraIssueDetails> {
  const token = await getAccessToken(connection, env, db);
  const { cloudId } = await getCloudId(token);
  const base = `https://api.atlassian.com/ex/jira/${cloudId}`;

  const myselfUrl = `${base}/rest/api/3/myself`;
  const myselfRes = await fetch(myselfUrl, { headers: jiraHeaders(token) });
  if (!myselfRes.ok) throwForStatus(myselfRes.status, myselfUrl);
  const myself = (await myselfRes.json()) as { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } };

  const issueUrl = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}?expand=renderedFields&fields=summary,description,status,priority,assignee,reporter,comment`;
  const issueRes = await fetch(issueUrl, { headers: jiraHeaders(token) });
  if (!issueRes.ok) throwForStatus(issueRes.status, issueUrl);
  const issue = (await issueRes.json()) as {
    key: string;
    fields: {
      summary: string;
      status: { name: string; statusCategory: { key: string } };
      priority?: { name: string; iconUrl: string } | null;
      assignee?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } } | null;
      reporter?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } } | null;
      comment?: { total: number };
    };
    renderedFields?: { description?: string };
  };

  const transitionsUrl = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
  const transitionsRes = await fetch(transitionsUrl, { headers: jiraHeaders(token) });
  if (!transitionsRes.ok) throwForStatus(transitionsRes.status, transitionsUrl);
  const transitionsData = (await transitionsRes.json()) as {
    transitions: Array<{ id: string; name: string; to: { name: string } }>;
  };

  const commentsUrl = `${base}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment?maxResults=20&orderBy=-created&expand=renderedBody`;
  const commentsRes = await fetch(commentsUrl, { headers: jiraHeaders(token) });
  if (!commentsRes.ok) throwForStatus(commentsRes.status, commentsUrl);
  const commentsData = (await commentsRes.json()) as {
    comments: Array<{
      id: string;
      author?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } };
      renderedBody?: string;
      created: string;
    }>;
    total: number;
  };

  const comments: DetailComment[] = commentsData.comments.map((c) => ({
    id: c.id,
    author: {
      name: c.author?.displayName ?? 'unknown',
      avatar: c.author?.avatarUrls?.['48x48'],
    },
    bodyHtml: c.renderedBody ?? '',
    createdAt: c.created,
  }));

  return {
    kind: 'jira_issue',
    key: issue.key,
    summary: issue.fields.summary,
    status: {
      name: issue.fields.status.name,
      category: mapStatusCategory(issue.fields.status.statusCategory.key),
    },
    priority: issue.fields.priority
      ? { name: issue.fields.priority.name, iconUrl: issue.fields.priority.iconUrl }
      : null,
    assignee: mapJiraUser(issue.fields.assignee),
    reporter: mapJiraUser(issue.fields.reporter),
    descriptionHtml: issue.renderedFields?.description ?? '',
    availableTransitions: transitionsData.transitions,
    comments,
    commentCount: issue.fields.comment?.total ?? commentsData.total,
    currentUser: {
      accountId: myself.accountId,
      displayName: myself.displayName,
      avatar: myself.avatarUrls?.['48x48'],
    },
  };
}

function adfParagraph(text: string): unknown {
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function jiraWrite(
  token: string,
  url: string,
  method: 'POST' | 'PUT',
  body: unknown,
): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: jiraHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throwForStatus(res.status, url);
}

export async function postJiraComment(
  connection: Connection,
  env: Env,
  db: D1Database,
  issueKey: string,
  body: string,
): Promise<void> {
  const token = await getAccessToken(connection, env, db);
  const { cloudId } = await getCloudId(token);
  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`;
  await jiraWrite(token, url, 'POST', { body: adfParagraph(body) });
}

export async function transitionJiraIssue(
  connection: Connection,
  env: Env,
  db: D1Database,
  issueKey: string,
  transitionId: string,
): Promise<void> {
  const token = await getAccessToken(connection, env, db);
  const { cloudId } = await getCloudId(token);
  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
  await jiraWrite(token, url, 'POST', { transition: { id: transitionId } });
}

export async function assignJiraSelf(
  connection: Connection,
  env: Env,
  db: D1Database,
  issueKey: string,
): Promise<void> {
  const token = await getAccessToken(connection, env, db);
  const { cloudId } = await getCloudId(token);

  const myselfRes = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
    headers: jiraHeaders(token),
  });
  if (!myselfRes.ok) throwForStatus(myselfRes.status, 'myself');
  const myself = (await myselfRes.json()) as { accountId: string };

  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee`;
  await jiraWrite(token, url, 'PUT', { accountId: myself.accountId });
}
