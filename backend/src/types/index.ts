export type Provider = 'github' | 'linear' | 'jira' | 'bitbucket';

export interface User {
  id: string;
  device_token: string;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  user_id: string;
  provider: Provider;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  account_id: string | null;
  account_name: string | null;
  account_avatar: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationAuthor {
  name: string;
  avatar?: string;
}

export interface NotificationResponse {
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

export interface Env {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  LINEAR_CLIENT_ID: string;
  LINEAR_CLIENT_SECRET: string;
  APP_URL: string;
}

export interface Variables {
  user: User;
}
