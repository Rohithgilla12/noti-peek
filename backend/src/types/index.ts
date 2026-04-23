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

export type LinkHint =
  | { kind: 'github-url'; url: string }
  | { kind: 'bitbucket-pr'; workspace: string; repo: string; id: string };

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
  /**
   * Optional native-integration references emitted by provider fetchers to help
   * the cross-bundling pure core avoid a second API round-trip. Always strict
   * signal when present.
   */
  linkHints?: LinkHint[];
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
  CROSS_PROVIDER_BUNDLING?: string;  // 'true' | 'false', defaults to 'true' when unset
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

export type WorkLinkPair = 'linear-github' | 'jira-bitbucket';

export type WorkLinkSignal = 'strict' | 'confirmed-fuzzy';

export type StrictSource =
  | 'title-prefix'
  | 'body-trailer'
  | 'linear-attachment'
  | 'jira-dev-panel';

export interface WorkLink {
  user_id: string;
  pair: WorkLinkPair;
  primary_key: string;       // e.g. "LIN-142", "ABC-78"
  linked_ref: string;        // e.g. "noti-peek#423", "workspace/repo#42"
  signal: WorkLinkSignal;
  strict_source: StrictSource | null;
  confirmed_at: string;      // ISO8601
  last_seen_at: string;      // ISO8601
}

export type SuggestionDecisionKind = 'dismissed' | 'confirmed';

export interface SuggestionDecision {
  user_id: string;
  pair: WorkLinkPair;
  primary_key: string;
  linked_ref: string;
  decision: SuggestionDecisionKind;
  decided_at: string;
}

export interface CrossBundleLinkedSide {
  source: Provider;
  ref: string;
  url: string;
  signal: WorkLinkSignal;
  /**
   * API-surface provenance. Present for `signal: 'strict'` rows; absent
   * (rather than `null`) for `signal: 'confirmed-fuzzy'`. This is an
   * intentional divergence from `WorkLink.strict_source` (the DB row), which
   * stores explicit `null`. The mapping layer strips the field when null.
   */
  strict_source?: StrictSource;
}

export interface CrossBundleResponse {
  id: string;                // `xbundle:${pair}:${primary_key}:${earliest_iso}`
  pair: WorkLinkPair;
  primary: {
    source: Provider;
    key: string;
    title: string;
    url: string;
  };
  linked: CrossBundleLinkedSide[];
  event_count: number;
  unread_count: number;
  actors: NotificationAuthor[];    // capped
  extra_actor_count: number;
  type_summary: Record<string, number>;
  source_summary: Partial<Record<Provider, number>>;
  latest_at: string;
  earliest_at: string;
  children: NotificationResponse[]; // chronological, newest first
}

export type SuggestedLinkRationale =
  | 'author-match'
  | 'title-overlap'
  | 'temporal-close'
  | 'both-open'
  | 'repo-affinity';

/**
 * `SuggestedLink.primary` / `.linked` carry `updatedAt` where
 * `CrossBundleResponse.primary` does not — the suggestions UI needs it to
 * render rationale (e.g. "both active within 24h"). A cross-bundle already
 * has `latest_at` at the top level, so per-side timestamps would be redundant.
 */
export interface SuggestedLink {
  id: string;                       // hash of (pair, primary_key, linked_ref)
  pair: WorkLinkPair;
  primary: { source: Provider; key: string; title: string; url: string; updatedAt: string };
  linked:  { source: Provider; ref: string; title: string; url: string; updatedAt: string };
  confidence: number;               // 0..1
  rationale: SuggestedLinkRationale[];
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
