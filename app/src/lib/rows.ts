import type { Provider, Notification, NotificationAuthor } from './types';

export type WorkLinkPair = 'linear-github' | 'jira-bitbucket';
export type WorkLinkSignal = 'strict' | 'confirmed-fuzzy';

export type StrictSource =
  | 'title-prefix' | 'body-trailer' | 'linear-attachment' | 'jira-dev-panel';

export interface BundleResponse {
  id: string;
  source: Provider;
  thread_key: string;
  title: string;
  url: string;
  event_count: number;
  unread_count: number;
  actors: NotificationAuthor[];
  extra_actor_count: number;
  type_summary: Record<string, number>;
  latest_at: string;
  earliest_at: string;
  children: Notification[];
}

export interface CrossBundleLinkedSide {
  source: Provider;
  ref: string;
  url: string;
  signal: WorkLinkSignal;
  strict_source?: StrictSource;
}

export interface CrossBundleResponse {
  id: string;
  pair: WorkLinkPair;
  primary: { source: Provider; key: string; title: string; url: string };
  linked: CrossBundleLinkedSide[];
  event_count: number;
  unread_count: number;
  actors: NotificationAuthor[];
  extra_actor_count: number;
  type_summary: Record<string, number>;
  source_summary: Partial<Record<Provider, number>>;
  latest_at: string;
  earliest_at: string;
  children: Notification[];
}

export type NotificationRow =
  | { kind: 'single'; notification: Notification }
  | { kind: 'bundle'; bundle: BundleResponse }
  | { kind: 'cross_bundle'; bundle: CrossBundleResponse };

export type SuggestedLinkRationale =
  | 'author-match' | 'title-overlap' | 'temporal-close' | 'both-open' | 'repo-affinity';

export interface SuggestedLink {
  id: string;
  pair: WorkLinkPair;
  primary: { source: Provider; key: string; title: string; url: string; updatedAt: string };
  linked:  { source: Provider; ref: string; title: string; url: string; updatedAt: string };
  confidence: number;
  rationale: SuggestedLinkRationale[];
}
