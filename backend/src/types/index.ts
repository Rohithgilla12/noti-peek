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
  JIRA_CLIENT_ID: string;
  JIRA_CLIENT_SECRET: string;
  BITBUCKET_CLIENT_ID: string;
  BITBUCKET_CLIENT_SECRET: string;
  APP_URL: string;
  ENABLE_EXPERIMENTAL_PROVIDERS?: string;
}

export interface Variables {
  user: User;
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

export interface NotificationFetchResult {
  notifications: NotificationResponse[];
  rateLimitInfo?: RateLimitInfo;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly resetAt: number,
    public readonly remaining: number = 0
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InsufficientScopeError extends Error {
  constructor(
    message: string,
    public readonly reconnectProvider: 'github' | 'jira'
  ) {
    super(message);
    this.name = 'InsufficientScopeError';
  }
}

export interface DetailCommentAuthor {
  name: string;
  avatar?: string;
}

export interface DetailComment {
  id: string;
  author: DetailCommentAuthor;
  bodyHtml: string;
  createdAt: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubUser {
  login: string;
  avatar: string;
}

export interface GitHubIssueDetails {
  kind: 'github_issue';
  number: number;
  state: 'open' | 'closed';
  stateReason: 'completed' | 'not_planned' | 'reopened' | null;
  title: string;
  bodyHtml: string;
  author: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  comments: DetailComment[];
  commentCount: number;
  permissions: { canComment: boolean; canClose: boolean };
}

export interface GitHubPRDetails {
  kind: 'github_pr';
  number: number;
  state: 'open' | 'closed';
  stateReason: 'completed' | 'not_planned' | 'reopened' | null;
  title: string;
  bodyHtml: string;
  author: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  comments: DetailComment[];
  commentCount: number;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  checks: { passed: number; failed: number; pending: number };
  permissions: { canComment: boolean; canReview: boolean; canMerge: boolean; canClose: boolean };
}

export interface JiraDetailUser {
  accountId: string;
  displayName: string;
  avatar?: string;
}

export interface JiraIssueDetails {
  kind: 'jira_issue';
  key: string;
  summary: string;
  status: { name: string; category: 'new' | 'indeterminate' | 'done' | 'unknown' };
  priority: { name: string; iconUrl: string } | null;
  assignee: JiraDetailUser | null;
  reporter: JiraDetailUser | null;
  descriptionHtml: string;
  availableTransitions: Array<{ id: string; name: string; to: { name: string } }>;
  comments: DetailComment[];
  commentCount: number;
  currentUser: JiraDetailUser;
}

export type NotificationDetails = GitHubIssueDetails | GitHubPRDetails | JiraIssueDetails;

export interface DetailResponse {
  id: string;
  source: 'github' | 'jira';
  details: NotificationDetails;
  fetchedAt: string;
}
