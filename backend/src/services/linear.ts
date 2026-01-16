import type { NotificationResponse, Connection } from '../types';

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

export async function fetchLinearNotifications(connection: Connection): Promise<NotificationResponse[]> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': connection.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: NOTIFICATIONS_QUERY,
      variables: { first: 50 },
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Linear token expired or revoked');
    }
    throw new Error(`Linear API error: ${response.status}`);
  }

  const result = await response.json() as LinearResponse;

  if (result.errors) {
    throw new Error(`Linear GraphQL error: ${result.errors[0].message}`);
  }

  const notifications = result.data?.notifications.nodes ?? [];

  return notifications
    .filter((n) => n.issue)
    .map((n): NotificationResponse => ({
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
    }));
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
