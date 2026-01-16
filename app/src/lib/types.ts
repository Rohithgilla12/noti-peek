export type Provider = 'github' | 'linear' | 'jira' | 'bitbucket';

export interface NotificationAuthor {
  name: string;
  avatar?: string;
}

export interface Notification {
  id: string;
  source: Provider;
  type: string;
  title: string;
  body?: string;
  url: string;
  repo?: string;
  project?: string;
  author: NotificationAuthor;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  provider: Provider;
  accountId: string | null;
  accountName: string | null;
  accountAvatar: string | null;
  connectedAt: string;
}

export interface AuthState {
  deviceToken: string | null;
  userId: string | null;
}
