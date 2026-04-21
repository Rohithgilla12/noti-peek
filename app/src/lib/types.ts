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
  firstSeenAt?: string;
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

