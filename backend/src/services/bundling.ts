import type { NotificationResponse, NotificationAuthor, Provider } from '../types';

/**
 * Smart bundling for noti-peek.
 *
 * Design: docs/smart-bundling.md
 *
 * Core rule: two or more notifications collapse into a bundle iff they share a
 * thread-key AND the most-recent event is within `RECENCY_WINDOW_MS` AND the
 * span (earliest → latest) is within `SPAN_WINDOW_MS` AND at least one child
 * is unread.
 *
 * This function is pure — call it on the aggregated notification list from the
 * provider fetches and it hands back a `NotificationRow[]` for the /notifications
 * response.
 */

export const BUNDLING_VERSION = 1;

// Heuristic windows.
export const RECENCY_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
export const SPAN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export const MIN_BUNDLE_SIZE = 2;
export const MAX_ACTORS_SHOWN = 3;

// Notification types that never bundle — they're one-off events that share a
// URL scheme at best, never a conversational thread.
const NEVER_BUNDLE_TYPES = new Set(['release', 'commit', 'check_suite']);

export interface BundleResponse {
  id: string;
  source: Provider;
  thread_key: string;
  title: string;
  url: string;
  event_count: number;
  unread_count: number;
  actors: NotificationAuthor[]; // deduped, capped at MAX_ACTORS_SHOWN + 1 "+N" synthetic actor
  extra_actor_count: number; // N beyond MAX_ACTORS_SHOWN (0 if none)
  type_summary: Record<string, number>; // e.g. { comment: 3, review: 1 }
  latest_at: string;
  earliest_at: string;
  children: NotificationResponse[]; // chronological, newest first
}

export type NotificationRow =
  | { kind: 'single'; notification: NotificationResponse }
  | { kind: 'bundle'; bundle: BundleResponse };

export interface BundleOptions {
  now?: number; // for tests — defaults to Date.now()
}

/**
 * Extract a stable thread-key for grouping. Returns `null` when the notification
 * should never participate in bundling (release/commit/etc).
 */
export function extractThreadKey(n: NotificationResponse): string | null {
  if (NEVER_BUNDLE_TYPES.has(n.type)) return null;

  const url = n.url || '';

  switch (n.source) {
    case 'github': {
      // Match /{owner}/{repo}/(pull|issues|discussions)/{number}
      const m = url.match(/github\.com\/([^/]+\/[^/]+)\/(pull|issues|discussions)\/(\d+)/i);
      if (m) return `github:${m[1]}:${m[2]}:${m[3]}`;
      return null; // unrecognized URL shape → do not bundle
    }

    case 'linear': {
      // Linear issue URLs look like https://linear.app/<team-slug>/issue/<KEY-123>/...
      const m = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
      if (m) return `linear:${m[1].toUpperCase()}`;
      return null;
    }

    case 'jira': {
      // Jira URLs contain issue keys like /browse/PROJ-123
      const m = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
      if (m) return `jira:${m[1].toUpperCase()}`;
      return null;
    }

    case 'bitbucket': {
      // https://bitbucket.org/<workspace>/<repo>/pull-requests/<id>
      const m = url.match(/bitbucket\.org\/([^/]+\/[^/]+)\/pull-requests\/(\d+)/i);
      if (m) return `bitbucket:${m[1]}:pr:${m[2]}`;
      return null;
    }

    default:
      return null;
  }
}

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function authorKey(a: NotificationAuthor): string {
  // Prefer name for dedup — if avatars differ across providers but it's the same
  // human, collapsing by name is the right call for UX.
  return a.name.trim().toLowerCase();
}

function buildBundle(
  source: Provider,
  thread_key: string,
  children: NotificationResponse[],
): BundleResponse {
  // Sort newest first — canonical child order.
  const sorted = [...children].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));

  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];

  // Dedup actors preserving first-appearance order (newest activity wins).
  const seen = new Set<string>();
  const actors: NotificationAuthor[] = [];
  for (const c of sorted) {
    const key = authorKey(c.author);
    if (seen.has(key)) continue;
    seen.add(key);
    actors.push({ name: c.author.name, avatar: c.author.avatar });
  }

  const extra_actor_count = Math.max(0, actors.length - MAX_ACTORS_SHOWN);
  const actorsCapped = actors.slice(0, MAX_ACTORS_SHOWN);

  const type_summary: Record<string, number> = {};
  for (const c of sorted) {
    type_summary[c.type] = (type_summary[c.type] ?? 0) + 1;
  }

  const unread_count = sorted.filter((c) => c.unread).length;

  return {
    id: `bundle:${source}:${thread_key}:${earliest.updatedAt}`,
    source,
    thread_key,
    title: latest.title,
    url: latest.url,
    event_count: sorted.length,
    unread_count,
    actors: actorsCapped,
    extra_actor_count,
    type_summary,
    latest_at: latest.updatedAt,
    earliest_at: earliest.updatedAt,
    children: sorted,
  };
}

/**
 * Split notifications sharing a thread_key into one-or-more bundle candidates
 * by walking newest-first and starting a new window every time the gap from the
 * current candidate's earliest exceeds SPAN_WINDOW_MS.
 *
 * Example: 8 notifications on thread X spanning 3 days — the heuristic emits
 * ceil(3d / 24h) = up to 3 separate bundles, each its own 24h window.
 */
function windowSplit(sameThread: NotificationResponse[]): NotificationResponse[][] {
  if (sameThread.length <= 1) return [sameThread];
  // Newest first.
  const sorted = [...sameThread].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));

  const windows: NotificationResponse[][] = [];
  let current: NotificationResponse[] = [sorted[0]];
  let currentEarliestMs = toMs(sorted[0].updatedAt);

  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    const nMs = toMs(n.updatedAt);
    if (currentEarliestMs - nMs <= SPAN_WINDOW_MS) {
      current.push(n);
      currentEarliestMs = nMs; // sorted desc, so nMs is always ≤ currentEarliestMs
    } else {
      windows.push(current);
      current = [n];
      currentEarliestMs = nMs;
    }
  }
  windows.push(current);
  return windows;
}

export function bundleNotifications(
  notifications: NotificationResponse[],
  opts: BundleOptions = {},
): NotificationRow[] {
  const now = opts.now ?? Date.now();
  const recencyCutoffMs = now - RECENCY_WINDOW_MS;

  // Group by thread key. Notifications with `null` key go straight to singletons.
  const groups = new Map<string, NotificationResponse[]>();
  const unbundleable: NotificationResponse[] = [];

  for (const n of notifications) {
    const key = extractThreadKey(n);
    if (key === null) {
      unbundleable.push(n);
      continue;
    }
    const existing = groups.get(key);
    if (existing) existing.push(n);
    else groups.set(key, [n]);
  }

  const rows: NotificationRow[] = [];

  for (const [thread_key, group] of groups) {
    const source = group[0].source;
    const windows = windowSplit(group);

    for (const window of windows) {
      const latestMs = Math.max(...window.map((n) => toMs(n.updatedAt)));
      const hasUnread = window.some((n) => n.unread);

      // Must have ≥2 items, be recent enough, and include at least one unread.
      if (
        window.length >= MIN_BUNDLE_SIZE &&
        latestMs >= recencyCutoffMs &&
        hasUnread
      ) {
        rows.push({ kind: 'bundle', bundle: buildBundle(source, thread_key, window) });
      } else {
        for (const n of window) {
          rows.push({ kind: 'single', notification: n });
        }
      }
    }
  }

  for (const n of unbundleable) {
    rows.push({ kind: 'single', notification: n });
  }

  // Final order: newest first. Bundles use `latest_at`.
  rows.sort((a, b) => rowLatestMs(b) - rowLatestMs(a));

  return rows;
}

function rowLatestMs(row: NotificationRow): number {
  if (row.kind === 'single') return toMs(row.notification.updatedAt);
  return toMs(row.bundle.latest_at);
}
