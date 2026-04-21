import { describe, it, expect } from 'vitest';
import type { NotificationResponse, Provider } from '../types';
import {
  bundleNotifications,
  extractThreadKey,
  BUNDLING_VERSION,
  RECENCY_WINDOW_MS,
  SPAN_WINDOW_MS,
  MAX_ACTORS_SHOWN,
} from './bundling';

// Fixed "now" for deterministic recency checks.
// Wed Apr 15 2026 12:00:00Z — chosen so relative offsets below are easy to eyeball.
const NOW_MS = Date.parse('2026-04-15T12:00:00.000Z');
const iso = (offsetMs: number) => new Date(NOW_MS + offsetMs).toISOString();

function notif(
  overrides: Partial<NotificationResponse> & { id: string; source: Provider; url: string },
): NotificationResponse {
  return {
    type: 'comment',
    title: overrides.title ?? 'Untitled',
    body: overrides.body,
    repo: overrides.repo,
    project: overrides.project,
    author: overrides.author ?? { name: 'alice' },
    unread: overrides.unread ?? true,
    createdAt: overrides.createdAt ?? iso(-5 * 60 * 1000),
    updatedAt: overrides.updatedAt ?? iso(-5 * 60 * 1000),
    ...overrides,
  };
}

describe('bundling constants', () => {
  it('exports a stable version number the app can pin to', () => {
    expect(BUNDLING_VERSION).toBe(1);
  });

  it('has a recency window shorter than the span window', () => {
    expect(RECENCY_WINDOW_MS).toBeLessThan(SPAN_WINDOW_MS);
  });
});

describe('extractThreadKey', () => {
  it('returns null for release/commit/check_suite (never-bundle types)', () => {
    const n = notif({
      id: 'github:1',
      source: 'github',
      type: 'release',
      url: 'https://github.com/o/r/releases/tag/v1',
    });
    expect(extractThreadKey(n)).toBeNull();
  });

  it('keys GitHub PR URLs to owner:repo:pull:number', () => {
    const n = notif({
      id: 'github:1',
      source: 'github',
      url: 'https://github.com/Rohithgilla12/noti-peek/pull/423',
    });
    expect(extractThreadKey(n)).toBe('github:Rohithgilla12/noti-peek:pull:423');
  });

  it('keys GitHub issue URLs distinctly from PR URLs on the same number', () => {
    const pr = notif({
      id: 'github:1',
      source: 'github',
      url: 'https://github.com/o/r/pull/5',
    });
    const issue = notif({
      id: 'github:2',
      source: 'github',
      url: 'https://github.com/o/r/issues/5',
    });
    expect(extractThreadKey(pr)).not.toBe(extractThreadKey(issue));
  });

  it('keys Linear URLs to the issue identifier', () => {
    const n = notif({
      id: 'linear:1',
      source: 'linear',
      url: 'https://linear.app/acme/issue/ENG-123/do-the-thing',
    });
    expect(extractThreadKey(n)).toBe('linear:ENG-123');
  });

  it('keys Jira URLs to the issue key', () => {
    const n = notif({
      id: 'jira:1',
      source: 'jira',
      url: 'https://acme.atlassian.net/browse/PROJ-42',
    });
    expect(extractThreadKey(n)).toBe('jira:PROJ-42');
  });

  it('keys Bitbucket PR URLs to workspace/repo:pr:number', () => {
    const n = notif({
      id: 'bitbucket:1',
      source: 'bitbucket',
      url: 'https://bitbucket.org/acme/app/pull-requests/17',
    });
    expect(extractThreadKey(n)).toBe('bitbucket:acme/app:pr:17');
  });

  it('returns null for unrecognized URL shapes', () => {
    const n = notif({
      id: 'github:1',
      source: 'github',
      url: 'https://example.com/not-github',
    });
    expect(extractThreadKey(n)).toBeNull();
  });
});

describe('bundleNotifications', () => {
  it('returns an empty array for empty input', () => {
    expect(bundleNotifications([], { now: NOW_MS })).toEqual([]);
  });

  it('passes through a single notification as a singleton row', () => {
    const rows = bundleNotifications(
      [notif({ id: 'github:1', source: 'github', url: 'https://github.com/o/r/pull/1' })],
      { now: NOW_MS },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('single');
  });

  it('bundles two same-thread notifications within the recency + span windows', () => {
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:1',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-60 * 1000),
          author: { name: 'alice' },
          type: 'comment',
        }),
        notif({
          id: 'github:2',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-10 * 60 * 1000),
          author: { name: 'bob' },
          type: 'comment',
        }),
      ],
      { now: NOW_MS },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('bundle');
    if (rows[0].kind !== 'bundle') throw new Error('type guard');
    expect(rows[0].bundle.event_count).toBe(2);
    expect(rows[0].bundle.children.map((c) => c.id)).toEqual(['github:1', 'github:2']);
    expect(rows[0].bundle.actors.map((a) => a.name)).toEqual(['alice', 'bob']);
  });

  it('does NOT bundle when no child is within the recency window', () => {
    // Both events are older than 4h — bundle dissolves into singletons even
    // though they share a thread and fit the span window.
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:1',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-5 * 60 * 60 * 1000), // 5h ago
        }),
        notif({
          id: 'github:2',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-6 * 60 * 60 * 1000), // 6h ago
        }),
      ],
      { now: NOW_MS },
    );
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });

  it('splits into separate bundles when events span more than SPAN_WINDOW_MS', () => {
    // Three events on the same thread: now, 12h ago, 48h ago.
    // Expected: events at `now` and `-12h` bundle; event at `-48h` is a singleton
    // (its gap from the -12h anchor is 36h > 24h span).
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:1',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-10 * 60 * 1000),
          author: { name: 'alice' },
        }),
        notif({
          id: 'github:2',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-12 * 60 * 60 * 1000),
          author: { name: 'bob' },
        }),
        notif({
          id: 'github:3',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-48 * 60 * 60 * 1000),
          author: { name: 'carol' },
        }),
      ],
      { now: NOW_MS },
    );

    const bundles = rows.filter((r) => r.kind === 'bundle');
    const singles = rows.filter((r) => r.kind === 'single');
    expect(bundles).toHaveLength(1);
    expect(singles).toHaveLength(1);
    if (bundles[0].kind !== 'bundle') throw new Error('type guard');
    expect(bundles[0].bundle.event_count).toBe(2);
  });

  it('does NOT bundle when all children are already read', () => {
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:1',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-5 * 60 * 1000),
          unread: false,
        }),
        notif({
          id: 'github:2',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-10 * 60 * 1000),
          unread: false,
        }),
      ],
      { now: NOW_MS },
    );
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });

  it('deduplicates actors by name and caps display at MAX_ACTORS_SHOWN', () => {
    const mkn = (i: number, name: string, minsAgo: number) =>
      notif({
        id: `github:${i}`,
        source: 'github',
        url: 'https://github.com/o/r/pull/7',
        updatedAt: iso(-minsAgo * 60 * 1000),
        author: { name },
        type: 'comment',
      });

    const rows = bundleNotifications(
      [
        mkn(1, 'alice', 1),
        mkn(2, 'alice', 2), // duplicate — should dedup
        mkn(3, 'bob', 3),
        mkn(4, 'carol', 4),
        mkn(5, 'dave', 5), // 4th unique actor → trimmed from display, counted in extra
      ],
      { now: NOW_MS },
    );

    expect(rows).toHaveLength(1);
    if (rows[0].kind !== 'bundle') throw new Error('type guard');
    const b = rows[0].bundle;
    expect(b.event_count).toBe(5);
    expect(b.actors).toHaveLength(MAX_ACTORS_SHOWN);
    expect(b.actors.map((a) => a.name)).toEqual(['alice', 'bob', 'carol']);
    expect(b.extra_actor_count).toBe(1); // dave is the overflow
  });

  it('builds a correct type_summary across mixed event types', () => {
    const mkn = (i: number, type: string, minsAgo: number) =>
      notif({
        id: `github:${i}`,
        source: 'github',
        url: 'https://github.com/o/r/pull/9',
        updatedAt: iso(-minsAgo * 60 * 1000),
        type,
      });

    const rows = bundleNotifications(
      [mkn(1, 'comment', 1), mkn(2, 'comment', 2), mkn(3, 'review', 3)],
      { now: NOW_MS },
    );
    expect(rows).toHaveLength(1);
    if (rows[0].kind !== 'bundle') throw new Error('type guard');
    expect(rows[0].bundle.type_summary).toEqual({ comment: 2, review: 1 });
  });

  it('keeps Release notifications as singletons even when sharing a repo URL', () => {
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:r1',
          source: 'github',
          type: 'release',
          url: 'https://github.com/o/r/releases/tag/v1.0.0',
          updatedAt: iso(-10 * 60 * 1000),
        }),
        notif({
          id: 'github:r2',
          source: 'github',
          type: 'release',
          url: 'https://github.com/o/r/releases/tag/v1.1.0',
          updatedAt: iso(-20 * 60 * 1000),
        }),
      ],
      { now: NOW_MS },
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });

  it('does not group notifications from different sources on the same number', () => {
    // A GitHub PR #5 and a Jira PROJ-5 — same path fragment '5' but unrelated threads.
    const rows = bundleNotifications(
      [
        notif({
          id: 'github:1',
          source: 'github',
          url: 'https://github.com/o/r/pull/5',
          updatedAt: iso(-1 * 60 * 1000),
        }),
        notif({
          id: 'jira:1',
          source: 'jira',
          url: 'https://acme.atlassian.net/browse/PROJ-5',
          updatedAt: iso(-2 * 60 * 1000),
        }),
      ],
      { now: NOW_MS },
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'single')).toBe(true);
  });

  it('returns rows sorted newest-first across bundle and singleton mix', () => {
    const rows = bundleNotifications(
      [
        // bundle candidate (pull/1) — latest 1 min ago
        notif({
          id: 'a',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-1 * 60 * 1000),
        }),
        notif({
          id: 'b',
          source: 'github',
          url: 'https://github.com/o/r/pull/1',
          updatedAt: iso(-30 * 60 * 1000),
        }),
        // lonely release from 30 seconds ago — must surface FIRST (newer than bundle latest)
        notif({
          id: 'c',
          source: 'github',
          type: 'release',
          url: 'https://github.com/o/r/releases/tag/v9',
          updatedAt: iso(-30 * 1000),
        }),
      ],
      { now: NOW_MS },
    );

    expect(rows[0].kind).toBe('single');
    if (rows[0].kind !== 'single') throw new Error('type guard');
    expect(rows[0].notification.id).toBe('c');
  });

  it('produces a deterministic bundle id for the same input', () => {
    const input = [
      notif({
        id: 'github:1',
        source: 'github',
        url: 'https://github.com/o/r/pull/1',
        updatedAt: iso(-60 * 1000),
      }),
      notif({
        id: 'github:2',
        source: 'github',
        url: 'https://github.com/o/r/pull/1',
        updatedAt: iso(-10 * 60 * 1000),
      }),
    ];

    const a = bundleNotifications(input, { now: NOW_MS });
    const b = bundleNotifications(input, { now: NOW_MS });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    if (a[0].kind !== 'bundle' || b[0].kind !== 'bundle') throw new Error('type guard');
    expect(a[0].bundle.id).toBe(b[0].bundle.id);
  });
});
