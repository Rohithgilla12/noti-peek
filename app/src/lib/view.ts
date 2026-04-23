import type { Notification, Provider } from './types';

export type Scope = 'inbox' | 'mentions' | 'bookmarks' | 'links' | 'archive';
export type QuickFilter = 'unread' | 'errors' | 'prs';

export interface ViewState {
  tab: 'inbox' | 'pulse';
  scope: Scope;
  filters: Set<QuickFilter>;
  sources: Set<Provider>;
}

export const DEFAULT_VIEW: ViewState = {
  tab: 'inbox',
  scope: 'inbox',
  filters: new Set(),
  sources: new Set(),
};

const PR_TYPES = new Set(['pr', 'review', 'review_requested']);
const MENTION_TYPES = new Set(['mentioned', 'review_requested']);

function matchesScope(n: Notification, scope: Scope): boolean {
  switch (scope) {
    case 'inbox':     return !n.archived;
    case 'mentions':  return !n.archived && MENTION_TYPES.has(n.type);
    case 'bookmarks': return !!n.bookmarked;
    case 'archive':   return !!n.archived;
    // The 'links' scope doesn't render the notification stream — it renders
    // SuggestedLinks instead. No notification row ever matches it, so
    // DayStream's list is empty and the SuggestedLinks component takes over.
    case 'links':     return false;
  }
}

function matchesQuickFilter(n: Notification, f: QuickFilter): boolean {
  switch (f) {
    case 'unread': return n.unread;
    case 'prs':    return PR_TYPES.has(n.type);
    // 'errors' is a UI concept backed by connection state, not per-row.
    // Never matches a notification row; the stream renders synthetic
    // error cards when this filter is active.
    case 'errors': return false;
  }
}

export function matchesView(n: Notification, v: ViewState): boolean {
  if (!matchesScope(n, v.scope)) return false;
  for (const f of v.filters) {
    if (!matchesQuickFilter(n, f)) return false;
  }
  if (v.sources.size > 0 && !v.sources.has(n.source)) return false;
  return true;
}

export function countForScope(all: Notification[], scope: Scope): number {
  if (scope === 'links') return 0;
  let count = 0;
  for (const n of all) if (matchesScope(n, scope)) count++;
  return count;
}

export function countForQuickFilter(all: Notification[], f: QuickFilter): number {
  if (f === 'errors') return 0; // caller replaces with error-connection count
  let count = 0;
  for (const n of all) if (matchesQuickFilter(n, f)) count++;
  return count;
}

export function countForSource(all: Notification[], p: Provider): number {
  let count = 0;
  for (const n of all) if (n.source === p) count++;
  return count;
}
