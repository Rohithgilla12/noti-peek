import type { NotificationResponse, Connection, NotificationFetchResult, Env } from '../types';
import { TokenExpiredError } from '../types';
import { linkHintsFromAttachments } from './linear-attachments';

interface LinearNotification {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  issue?: {
    id: string;
    identifier: string;
    title: string;
    url: string;
    team: {
      name: string;
      key: string;
    };
    attachments?: { nodes: Array<{ url: string }> };
  };
  comment?: {
    id: string;
    body: string;
  };
  actor?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface LinearResponse {
  data?: {
    notifications: {
      nodes: LinearNotification[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface LinearFetchOptions {
  maxPages?: number;
  perPage?: number;
}

interface LinearTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const NOTIFICATIONS_QUERY = `
  query Notifications($first: Int!, $after: String) {
    notifications(first: $first, after: $after) {
      nodes {
        id
        type
        createdAt
        updatedAt
        readAt
        ... on IssueNotification {
          issue {
            id
            identifier
            title
            url
            team {
              name
              key
            }
            attachments(first: 10) {
              nodes {
                url
              }
            }
          }
          comment {
            id
            body
          }
          actor {
            id
            name
            avatarUrl
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

function mapNotificationType(type: string): string {
  const typeMap: Record<string, string> = {
    'issueAssignedToYou': 'assigned',
    'issueMentioned': 'mentioned',
    'issueComment': 'comment',
    'issueStatusChanged': 'status_change',
    'issueNewComment': 'comment',
    'issuePriorityChanged': 'priority_change',
  };
  return typeMap[type] || type;
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

export async function refreshLinearToken(
  connection: Connection,
  env: Env,
  db: D1Database
): Promise<string> {
  if (!connection.refresh_token) {
    throw new TokenExpiredError('No refresh token available for Linear connection');
  }

  const response = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.LINEAR_CLIENT_ID,
      client_secret: env.LINEAR_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new TokenExpiredError('Failed to refresh Linear token');
  }

  const tokenData = await response.json() as LinearTokenResponse;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await db.prepare(`
    UPDATE connections
    SET access_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(tokenData.access_token, expiresAt, connection.id).run();

  return tokenData.access_token;
}

export async function fetchLinearNotifications(
  connection: Connection,
  env: Env,
  db: D1Database,
  options: LinearFetchOptions = {}
): Promise<NotificationFetchResult> {
  const { maxPages = 5, perPage = 50 } = options;
  let accessToken = connection.access_token;

  if (isTokenExpired(connection)) {
    accessToken = await refreshLinearToken(connection, env, db);
  }

  const allNotifications: LinearNotification[] = [];
  let hasNextPage = true;
  let endCursor: string | null = null;
  let pagesFetched = 0;

  while (hasNextPage && pagesFetched < maxPages) {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: NOTIFICATIONS_QUERY,
        variables: { first: perPage, after: endCursor },
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new TokenExpiredError('Linear token expired or revoked');
      }
      throw new Error(`Linear API error: ${response.status}`);
    }

    const result = await response.json() as LinearResponse;

    if (result.errors) {
      const errorMessage = result.errors[0].message;
      if (errorMessage.includes('authentication') || errorMessage.includes('token')) {
        throw new TokenExpiredError(`Linear GraphQL error: ${errorMessage}`);
      }
      throw new Error(`Linear GraphQL error: ${errorMessage}`);
    }

    const notificationsData = result.data?.notifications;
    if (!notificationsData) break;

    allNotifications.push(...notificationsData.nodes);
    hasNextPage = notificationsData.pageInfo.hasNextPage;
    endCursor = notificationsData.pageInfo.endCursor;
    pagesFetched++;

    if (notificationsData.nodes.length < perPage) {
      break;
    }
  }

  const notifications = allNotifications
    .filter((n) => n.issue)
    .map((n): NotificationResponse => {
      const linkHints = linkHintsFromAttachments(n.issue?.attachments?.nodes);
      return {
        id: `linear:${n.id}`,
        source: 'linear',
        type: mapNotificationType(n.type),
        title: n.issue!.title,
        body: n.comment?.body?.slice(0, 200) || `${n.issue!.identifier} - ${n.issue!.team.name}`,
        url: n.issue!.url,
        project: n.issue!.team.name,
        author: {
          name: n.actor?.name || 'Linear',
          avatar: n.actor?.avatarUrl || undefined,
        },
        unread: n.readAt === null,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        ...(linkHints.length > 0 ? { linkHints } : {}),
      };
    });

  return {
    notifications,
  };
}

export async function markLinearNotificationAsRead(
  connection: Connection,
  notificationId: string
): Promise<void> {
  const linearId = notificationId.replace('linear:', '');

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': connection.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation MarkAsRead($id: String!) {
          notificationArchive(id: $id) {
            success
          }
        }
      `,
      variables: { id: linearId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark Linear notification as read: ${response.status}`);
  }
}

export async function markAllLinearNotificationsAsRead(connection: Connection): Promise<void> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': connection.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        mutation {
          notificationArchiveAll {
            success
          }
        }
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark all Linear notifications as read: ${response.status}`);
  }
}
