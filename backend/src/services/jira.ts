import type { NotificationResponse, Connection, NotificationFetchResult, Env, LinkHint } from '../types';
import { TokenExpiredError } from '../types';
import { fetchJiraDevPanel } from './jira-dev-panel';

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

interface JiraNotification {
  id: string;
  title: string;
  content: string;
  created: string;
  updated?: string;
  readState: 'read' | 'unread';
  category: string;
  metadata?: {
    issueKey?: string;
    issueId?: string;
    projectKey?: string;
    issueSummary?: string;
    jiraBaseUrl?: string;
  };
  user?: {
    accountId: string;
    displayName: string;
    avatarUrl?: string;
  };
}

interface JiraTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface JiraCloudResource {
  id: string;
  url: string;
  name: string;
}

interface JiraFetchOptions {
  maxPages?: number;
  perPage?: number;
}

function mapNotificationType(category: string): string {
  const typeMap: Record<string, string> = {
    'watching': 'watching',
    'mention': 'mentioned',
    'assigned': 'assigned',
    'comment': 'comment',
    'status': 'status_change',
    'direct': 'direct',
  };
  return typeMap[category] || category.toLowerCase();
}

function isTokenExpired(connection: Connection): boolean {
  if (!connection.token_expires_at) {
    return false;
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000;

  return expiresAt - bufferMs <= now;
}

export async function refreshJiraToken(
  connection: Connection,
  env: Env,
  db: D1Database
): Promise<string> {
  if (!connection.refresh_token) {
    throw new TokenExpiredError('No refresh token available for Jira connection');
  }

  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: env.JIRA_CLIENT_ID,
      client_secret: env.JIRA_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new TokenExpiredError('Failed to refresh Jira token');
  }

  const tokenData = await response.json() as JiraTokenResponse;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await db.prepare(`
    UPDATE connections
    SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    tokenData.access_token,
    tokenData.refresh_token ?? connection.refresh_token,
    expiresAt,
    connection.id
  ).run();

  return tokenData.access_token;
}

export async function fetchJiraNotifications(
  connection: Connection,
  env: Env,
  db: D1Database,
  options: JiraFetchOptions = {}
): Promise<NotificationFetchResult> {
  const { maxPages = 5, perPage = 50 } = options;
  let accessToken = connection.access_token;

  if (isTokenExpired(connection)) {
    accessToken = await refreshJiraToken(connection, env, db);
  }

  // Get cloud resources to find the cloud ID and base URL
  const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!resourcesResponse.ok) {
    throw new Error(`Failed to get Jira cloud resources: ${resourcesResponse.status}`);
  }

  const resources = await resourcesResponse.json() as JiraCloudResource[];
  if (resources.length === 0) {
    throw new Error('No Jira cloud resources available');
  }

  const cloudId = resources[0].id;
  const jiraBaseUrl = resources[0].url; // e.g., https://mycompany.atlassian.net
  const cloudBaseUrl = jiraBaseUrl;

  const devPanelCache = new Map<string, Promise<Array<Extract<LinkHint, { kind: 'bitbucket-pr' }>>>>();
  const getDevPanelHints = (issueId: string | undefined) => {
    if (!issueId) return Promise.resolve([] as Array<Extract<LinkHint, { kind: 'bitbucket-pr' }>>);
    let p = devPanelCache.get(issueId);
    if (!p) {
      p = fetchJiraDevPanel({
        connection, cloudBaseUrl, issueId, timeoutMs: 2000,
      });
      devPanelCache.set(issueId, p);
    }
    return p;
  };

  const allNotifications: JiraNotification[] = [];
  // The old GET /rest/api/3/search endpoint was removed (410 Gone). We now use
  // POST /rest/api/3/search/jql, which is token-paginated via nextPageToken.
  // Must specify `fields` explicitly (new endpoint returns minimal set otherwise).
  // `description` is intentionally omitted: it's now returned as ADF JSON rather
  // than plain text, and we only use it for a short body preview.
  const searchUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`;
  const jql = 'assignee = currentUser() OR watcher = currentUser() ORDER BY updated DESC';
  const fields = ['summary', 'updated', 'created', 'status', 'project', 'assignee', 'reporter'];

  let nextPageToken: string | undefined;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const body: { jql: string; maxResults: number; fields: string[]; nextPageToken?: string } = {
      jql,
      maxResults: perPage,
      fields,
    };
    if (nextPageToken) {
      body.nextPageToken = nextPageToken;
    }

    const issuesResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!issuesResponse.ok) {
      if (issuesResponse.status === 401) {
        throw new TokenExpiredError('Jira token expired or revoked');
      }
      throw new Error(`Jira issues API error: ${issuesResponse.status}`);
    }

    const issuesData = await issuesResponse.json() as {
      issues: Array<{
        id: string;
        key: string;
        fields: {
          summary: string;
          updated: string;
          created: string;
          status: { name: string };
          project: { key: string; name: string };
          assignee?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } };
          reporter?: { accountId: string; displayName: string; avatarUrls?: { '48x48'?: string } };
        };
        self: string;
      }>;
      nextPageToken?: string;
      isLast?: boolean;
    };

    for (const issue of issuesData.issues) {
      allNotifications.push({
        id: issue.id,
        title: `${issue.key}: ${issue.fields.summary}`,
        content: '',
        created: issue.fields.created,
        updated: issue.fields.updated,
        readState: 'unread', // Jira doesn't track read state the same way
        category: issue.fields.assignee ? 'assigned' : 'watching',
        metadata: {
          issueKey: issue.key,
          issueId: issue.id,
          projectKey: issue.fields.project.key,
          issueSummary: issue.fields.summary,
          jiraBaseUrl: jiraBaseUrl,
        },
        user: issue.fields.reporter ? {
          accountId: issue.fields.reporter.accountId,
          displayName: issue.fields.reporter.displayName,
          avatarUrl: issue.fields.reporter.avatarUrls?.['48x48'],
        } : undefined,
      });
    }

    if (issuesData.isLast || !issuesData.nextPageToken) {
      break;
    }

    nextPageToken = issuesData.nextPageToken;
    pagesFetched++;
  }

  const notifications = await mapWithConcurrency(allNotifications, 5, async (n): Promise<NotificationResponse> => {
    const linkHints = await getDevPanelHints(n.metadata?.issueId);
    return {
      id: `jira:${n.id}`,
      source: 'jira',
      type: mapNotificationType(n.category),
      title: n.title,
      body: n.content.slice(0, 200) || `${n.metadata?.projectKey} - ${n.category}`,
      url: `${n.metadata?.jiraBaseUrl}/browse/${n.metadata?.issueKey}`,
      project: n.metadata?.projectKey,
      author: {
        name: n.user?.displayName || 'Jira',
        avatar: n.user?.avatarUrl,
      },
      unread: n.readState === 'unread',
      createdAt: n.created,
      updatedAt: n.updated || n.created,
      ...(linkHints.length > 0 ? { linkHints } : {}),
    };
  });

  return {
    notifications,
  };
}

export async function markJiraNotificationAsRead(
  connection: Connection,
  notificationId: string,
  env: Env,
  db: D1Database
): Promise<void> {
  // Jira doesn't have a built-in notification read API like GitHub
  // The notification ID is the issue ID, so we could potentially track read state locally
  // For now, this is a no-op but maintains API consistency
  console.log(`Marking Jira notification ${notificationId} as read`);
}

export async function markAllJiraNotificationsAsRead(
  connection: Connection,
  env: Env,
  db: D1Database
): Promise<void> {
  // Jira doesn't have a bulk mark-as-read API
  // This maintains API consistency
  console.log('Marking all Jira notifications as read');
}
