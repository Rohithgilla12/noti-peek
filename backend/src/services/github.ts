import type { NotificationResponse, Connection } from '../types';

interface GitHubNotification {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at: string | null;
  subject: {
    title: string;
    url: string;
    latest_comment_url: string | null;
    type: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
      avatar_url: string;
    };
  };
  url: string;
}

function mapNotificationType(type: string): string {
  const typeMap: Record<string, string> = {
    'PullRequest': 'pull_request',
    'Issue': 'issue',
    'Release': 'release',
    'Discussion': 'discussion',
    'Commit': 'commit',
    'CheckSuite': 'check_suite',
  };
  return typeMap[type] || type.toLowerCase();
}

function getHtmlUrl(notification: GitHubNotification): string {
  const subjectUrl = notification.subject.url;
  if (!subjectUrl) return `https://github.com/${notification.repository.full_name}`;

  return subjectUrl
    .replace('api.github.com/repos', 'github.com')
    .replace('/pulls/', '/pull/')
    .replace('/issues/', '/issues/');
}

export async function fetchGitHubNotifications(connection: Connection): Promise<NotificationResponse[]> {
  const response = await fetch('https://api.github.com/notifications?all=false&per_page=50', {
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'User-Agent': 'noti-peek',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('GitHub token expired or revoked');
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const notifications = await response.json() as GitHubNotification[];

  return notifications.map((n): NotificationResponse => ({
    id: `github:${n.id}`,
    source: 'github',
    type: mapNotificationType(n.subject.type),
    title: n.subject.title,
    body: `${n.reason} in ${n.repository.full_name}`,
    url: getHtmlUrl(n),
    repo: n.repository.full_name,
    author: {
      name: n.repository.owner.login,
      avatar: n.repository.owner.avatar_url,
    },
    unread: n.unread,
    createdAt: n.updated_at,
    updatedAt: n.updated_at,
  }));
}

export async function markGitHubNotificationAsRead(
  connection: Connection,
  notificationId: string
): Promise<void> {
  const githubId = notificationId.replace('github:', '');

  const response = await fetch(`https://api.github.com/notifications/threads/${githubId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'User-Agent': 'noti-peek',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok && response.status !== 205) {
    throw new Error(`Failed to mark notification as read: ${response.status}`);
  }
}

export async function markAllGitHubNotificationsAsRead(connection: Connection): Promise<void> {
  const response = await fetch('https://api.github.com/notifications', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'User-Agent': 'noti-peek',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      last_read_at: new Date().toISOString(),
    }),
  });

  if (!response.ok && response.status !== 205) {
    throw new Error(`Failed to mark all notifications as read: ${response.status}`);
  }
}
