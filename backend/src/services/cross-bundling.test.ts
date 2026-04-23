import { describe, it, expect } from 'vitest';
import type { NotificationResponse } from '../types';
import {
  extractTitleKey,
  extractBodyTrailerKeys,
  collectStrictLinks,
  scoreFuzzyCandidates,
  FUZZY_THRESHOLD,
  buildCrossBundle,
  MAX_ACTORS_SHOWN,
  buildCrossBundles,
} from './cross-bundling';

describe('extractTitleKey', () => {
  it('matches bracketed prefix: [LIN-142] title', () => {
    expect(extractTitleKey('[LIN-142] Add rate limits')).toBe('LIN-142');
  });

  it('matches parenthesised prefix: (ABC-78) title', () => {
    expect(extractTitleKey('(ABC-78) fix flaky test')).toBe('ABC-78');
  });

  it('matches colon-separated prefix: LIN-142: title', () => {
    expect(extractTitleKey('LIN-142: Add rate limits')).toBe('LIN-142');
  });

  it('matches space-separated prefix: LIN-142 title', () => {
    expect(extractTitleKey('LIN-142 Add rate limits')).toBe('LIN-142');
  });

  it('matches key embedded mid-title', () => {
    expect(extractTitleKey('Address LIN-142 tail latency')).toBe('LIN-142');
  });

  it('normalises case to uppercase', () => {
    expect(extractTitleKey('lin-142: whatever')).toBe('LIN-142');
  });

  it('returns null for titles without any key', () => {
    expect(extractTitleKey('Refactor auth middleware')).toBeNull();
  });

  it('ignores single-letter prefixes (likely false positives)', () => {
    expect(extractTitleKey('A-1 quick thing')).toBeNull();
  });

  it('returns the first key when multiple are present', () => {
    expect(extractTitleKey('LIN-142 + LIN-200 — combined PR')).toBe('LIN-142');
  });

  it('rejects keys whose letter-prefix contains a digit (not letters-only)', () => {
    // ABCD1-2 — the prefix has a digit, which [A-Z]{2,10} forbids.
    expect(extractTitleKey('ABCD1-2 should not match')).toBeNull();
  });

  it('rejects a key glued to a preceding digit run (word-boundary enforcement)', () => {
    // 123AB-1 — at position 3 ('A'), the preceding '3' is a word char so \b fails.
    // No other position satisfies \b([A-Z]{2,10}-\d+)\b.
    expect(extractTitleKey('123AB-1 should not match')).toBeNull();
  });
});

describe('extractBodyTrailerKeys', () => {
  it('matches "Closes LIN-142"', () => {
    expect(extractBodyTrailerKeys('Closes LIN-142')).toEqual(['LIN-142']);
  });

  it('matches multiple closers in a body', () => {
    expect(extractBodyTrailerKeys('Closes LIN-1\nFixes LIN-2\nRelates to ABC-3')).toEqual(['LIN-1','LIN-2','ABC-3']);
  });

  it('matches case-insensitively, normalises to uppercase', () => {
    expect(extractBodyTrailerKeys('fixes lin-42')).toEqual(['LIN-42']);
  });

  it('does not match unrelated words like "See LIN-typos-142"', () => {
    expect(extractBodyTrailerKeys('See LIN-typos-142')).toEqual([]);
  });

  it('returns [] for empty or missing body', () => {
    expect(extractBodyTrailerKeys('')).toEqual([]);
    expect(extractBodyTrailerKeys(undefined)).toEqual([]);
  });

  it('deduplicates repeated keys', () => {
    expect(extractBodyTrailerKeys('Closes LIN-1. Fixes LIN-1.')).toEqual(['LIN-1']);
  });
});

// Fixture builder — the standard shape used across cross-bundling tests.
function notif(o: Partial<NotificationResponse> & Pick<NotificationResponse, 'id' | 'source' | 'url' | 'title'>): NotificationResponse {
  return {
    type: 'pr',
    body: undefined,
    author: { name: 'alice' },
    unread: true,
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    ...o,
  };
}

describe('collectStrictLinks — linear-github pair', () => {
  it('matches PR title prefix to a Linear notification in the same batch', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/423', title: '[LIN-142] Add rate limits' }),
      notif({ id: 'n2', source: 'linear', url: 'https://linear.app/t/issue/LIN-142/add-rate-limits', title: 'Add rate limits' }),
    ];
    const links = collectStrictLinks(notifications, 'linear-github');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      pair: 'linear-github',
      primary_key: 'LIN-142',
      linked_ref: 'o/r#423',
      strict_source: 'title-prefix',
    });
  });

  it('matches body trailer "Closes LIN-142"', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/423', title: 'unrelated title', body: 'Closes LIN-142' }),
      notif({ id: 'n2', source: 'linear', url: 'https://linear.app/t/issue/LIN-142/x', title: 'x' }),
    ];
    const links = collectStrictLinks(notifications, 'linear-github');
    expect(links).toHaveLength(1);
    expect(links[0].strict_source).toBe('body-trailer');
  });

  it('matches linkHints { kind: "github-url" } on a Linear notification', () => {
    const notifications = [
      notif({
        id: 'n1', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-142/x', title: 'x',
        linkHints: [{ kind: 'github-url', url: 'https://github.com/o/r/pull/423' }],
      }),
      notif({ id: 'n2', source: 'github', url: 'https://github.com/o/r/pull/423', title: 'unrelated' }),
    ];
    const links = collectStrictLinks(notifications, 'linear-github');
    expect(links).toHaveLength(1);
    expect(links[0].strict_source).toBe('linear-attachment');
  });

  it('emits no link when only one side is in the batch', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/423', title: '[LIN-142] ok' }),
    ];
    expect(collectStrictLinks(notifications, 'linear-github')).toEqual([]);
  });

  it('ignores GitHub releases even when title contains a key', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', type: 'release', url: 'https://github.com/o/r/releases/tag/v1', title: '[LIN-142] release' }),
      notif({ id: 'n2', source: 'linear', url: 'https://linear.app/t/issue/LIN-142/x', title: 'x' }),
    ];
    expect(collectStrictLinks(notifications, 'linear-github')).toEqual([]);
  });

  it('deduplicates when title-prefix and body-trailer both point at the same key', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/423', title: '[LIN-142] x', body: 'Closes LIN-142' }),
      notif({ id: 'n2', source: 'linear', url: 'https://linear.app/t/issue/LIN-142/x', title: 'x' }),
    ];
    const links = collectStrictLinks(notifications, 'linear-github');
    expect(links).toHaveLength(1);
    // title-prefix wins when both match the same pair
    expect(links[0].strict_source).toBe('title-prefix');
  });
});

describe('collectStrictLinks — jira-bitbucket pair', () => {
  it('matches PR title prefix to a Jira notification', () => {
    const notifications = [
      notif({ id: 'n1', source: 'bitbucket', url: 'https://bitbucket.org/ws/r/pull-requests/42', title: 'ABC-78: ship it' }),
      notif({ id: 'n2', source: 'jira', url: 'https://company.atlassian.net/browse/ABC-78', title: 'Ship it' }),
    ];
    const links = collectStrictLinks(notifications, 'jira-bitbucket');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      pair: 'jira-bitbucket',
      primary_key: 'ABC-78',
      linked_ref: 'ws/r#42',
      strict_source: 'title-prefix',
    });
  });

  it('matches linkHints { kind: "bitbucket-pr" } on a Jira notification', () => {
    const notifications = [
      notif({
        id: 'n1', source: 'jira',
        url: 'https://company.atlassian.net/browse/ABC-78', title: 'x',
        linkHints: [{ kind: 'bitbucket-pr', workspace: 'ws', repo: 'r', id: '42' }],
      }),
      notif({ id: 'n2', source: 'bitbucket', url: 'https://bitbucket.org/ws/r/pull-requests/42', title: 'y' }),
    ];
    const links = collectStrictLinks(notifications, 'jira-bitbucket');
    expect(links).toHaveLength(1);
    expect(links[0].strict_source).toBe('jira-dev-panel');
  });

  it('does not leak linear-github matches into jira-bitbucket pair', () => {
    const notifications = [
      notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/1', title: '[LIN-1] x' }),
      notif({ id: 'n2', source: 'linear', url: 'https://linear.app/t/issue/LIN-1/x', title: 'x' }),
    ];
    expect(collectStrictLinks(notifications, 'jira-bitbucket')).toEqual([]);
  });
});
describe('scoreFuzzyCandidates — linear-github', () => {
  it('emits a high-confidence candidate for same author + strong title overlap + same day', () => {
    const notifications = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9',
        title: 'add rate limits to actions endpoint',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/add-rate-limits',
        title: 'Add rate limits',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const cands = scoreFuzzyCandidates(notifications, 'linear-github', [], []);
    expect(cands).toHaveLength(1);
    expect(cands[0].confidence).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    expect(cands[0].rationale).toEqual(
      expect.arrayContaining(['author-match', 'title-overlap', 'temporal-close']),
    );
  });

  it('drops candidates below 0.7 confidence', () => {
    const notifications = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9',
        title: 'refactor module boundaries',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/unrelated-topic',
        title: 'unrelated topic for ratings',
        author: { name: 'bob' },
        updatedAt: '2026-04-10T10:00:00.000Z',
      }),
    ];
    expect(scoreFuzzyCandidates(notifications, 'linear-github', [], [])).toEqual([]);
  });

  it('does not suggest a pair that is already confirmed', () => {
    const notifications = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9',
        title: 'add rate limits',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/add-rate-limits',
        title: 'Add rate limits',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const decisions = [{
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-500', linked_ref: 'o/r#9',
      decision: 'confirmed', decided_at: '2026-04-21T00:00:00.000Z',
    } as const];
    expect(scoreFuzzyCandidates(notifications, 'linear-github', [], decisions)).toEqual([]);
  });

  it('does not suggest a pair the user has dismissed', () => {
    const notifications = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9',
        title: 'add rate limits',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/add-rate-limits',
        title: 'Add rate limits',
        author: { name: 'alice' },
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const decisions = [{
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-500', linked_ref: 'o/r#9',
      decision: 'dismissed', decided_at: '2026-04-21T00:00:00.000Z',
    } as const];
    expect(scoreFuzzyCandidates(notifications, 'linear-github', [], decisions)).toEqual([]);
  });

  it('skips never-bundle types', () => {
    const notifications = [
      notif({
        id: 'g', source: 'github', type: 'release',
        url: 'https://github.com/o/r/releases/tag/v1', title: 'add rate limits',
        author: { name: 'alice' }, updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/x', title: 'Add rate limits',
        author: { name: 'alice' }, updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    expect(scoreFuzzyCandidates(notifications, 'linear-github', [], [])).toEqual([]);
  });
});

describe('buildCrossBundle', () => {
  it('assembles a bundle anchored on the ticket side, children newest-first', () => {
    const ticket = notif({
      id: 'l', source: 'linear',
      url: 'https://linear.app/t/issue/LIN-1/x', title: 'LIN title',
      author: { name: 'alice' },
      updatedAt: '2026-04-22T08:00:00.000Z',
    });
    const pr = notif({
      id: 'g', source: 'github',
      url: 'https://github.com/o/r/pull/9', title: 'pr title',
      author: { name: 'bob' },
      type: 'review',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    const extraLinear = notif({
      id: 'l2', source: 'linear',
      url: 'https://linear.app/t/issue/LIN-1/x', title: 'comment',
      author: { name: 'carol' },
      type: 'comment',
      updatedAt: '2026-04-22T09:00:00.000Z',
    });

    const bundle = buildCrossBundle({
      pair: 'linear-github',
      primaryNotif: ticket,
      linkedNotifs: [pr],
      extraTicketSide: [extraLinear],
      extraPrSide: [],
      linkedSideMeta: [{
        source: 'github', ref: 'o/r#9', url: pr.url,
        signal: 'strict', strict_source: 'title-prefix',
      }],
    });

    expect(bundle.primary).toEqual({ source: 'linear', key: 'LIN-1', title: 'LIN title', url: ticket.url });
    expect(bundle.linked[0].ref).toBe('o/r#9');
    expect(bundle.children.map((c) => c.id)).toEqual(['g', 'l2', 'l']); // newest-first
    expect(bundle.event_count).toBe(3);
    expect(bundle.unread_count).toBe(3);
    expect(bundle.source_summary).toEqual({ linear: 2, github: 1 });
    expect(bundle.type_summary).toEqual({ pr: 1, review: 1, comment: 1 });
    expect(bundle.actors.map((a) => a.name)).toEqual(['bob', 'carol', 'alice']);
    expect(bundle.extra_actor_count).toBe(0);
    expect(bundle.latest_at).toBe('2026-04-22T10:00:00.000Z');
    expect(bundle.earliest_at).toBe('2026-04-22T08:00:00.000Z');
    expect(bundle.id).toBe('xbundle:linear-github:LIN-1:2026-04-22T08:00:00.000Z');
  });

  it('caps actors at MAX_ACTORS_SHOWN and reports extra_actor_count', () => {
    const ticket = notif({
      id: 'l', source: 'linear',
      url: 'https://linear.app/t/issue/LIN-2/x', title: 'x',
      author: { name: 'alice' }, updatedAt: '2026-04-22T08:00:00.000Z',
    });
    const prs = ['bob','carol','dan','eve'].map((name, i) => notif({
      id: `g${i}`, source: 'github', type: 'review',
      url: 'https://github.com/o/r/pull/9', title: 'pr',
      author: { name },
      updatedAt: `2026-04-22T1${i}:00:00.000Z`,
    }));

    const bundle = buildCrossBundle({
      pair: 'linear-github', primaryNotif: ticket,
      linkedNotifs: [prs[0]], extraTicketSide: [], extraPrSide: prs.slice(1),
      linkedSideMeta: [{ source: 'github', ref: 'o/r#9', url: prs[0].url, signal: 'strict', strict_source: 'title-prefix' }],
    });

    expect(bundle.actors).toHaveLength(MAX_ACTORS_SHOWN);
    expect(bundle.extra_actor_count).toBeGreaterThan(0);
    expect(bundle.actors.map((a) => a.name)).not.toContain('alice'); // alice is oldest and gets bumped
  });
});

const NOW = Date.parse('2026-04-22T12:00:00.000Z');

describe('buildCrossBundles orchestrator', () => {
  it('returns empty output when nothing links', () => {
    const result = buildCrossBundles({
      notifications: [
        notif({ id: 'n1', source: 'github', url: 'https://github.com/o/r/pull/1', title: 'unrelated' }),
      ],
      pair: 'linear-github',
      workLinks: [], decisions: [],
      userId: 'u', now: NOW,
    });
    expect(result.crossBundles).toEqual([]);
    expect(result.strictLinksInferred).toEqual([]);
    expect(result.fuzzyCandidates).toEqual([]);
    expect([...result.consumedNotificationIds]).toEqual([]);
  });

  it('emits a cross_bundle + a strict link upsert when title-prefix matches', () => {
    const notifs = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/423', title: '[LIN-142] Add rate limits',
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-142/add-rate-limits', title: 'Add rate limits',
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const result = buildCrossBundles({
      notifications: notifs, pair: 'linear-github',
      workLinks: [], decisions: [],
      userId: 'u', now: NOW,
    });
    expect(result.crossBundles).toHaveLength(1);
    expect(result.strictLinksInferred).toHaveLength(1);
    expect(result.strictLinksInferred[0]).toMatchObject({
      user_id: 'u', pair: 'linear-github',
      primary_key: 'LIN-142', linked_ref: 'o/r#423',
      signal: 'strict', strict_source: 'title-prefix',
    });
    expect([...result.consumedNotificationIds].sort()).toEqual(['g', 'l']);
    expect(result.fuzzyCandidates).toEqual([]);
  });

  it('reuses an existing confirmed-fuzzy link without rescoring', () => {
    const notifs = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9', title: 'unrelated title',
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-500/x', title: 'x',
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const result = buildCrossBundles({
      notifications: notifs, pair: 'linear-github',
      workLinks: [{
        user_id: 'u', pair: 'linear-github',
        primary_key: 'LIN-500', linked_ref: 'o/r#9',
        signal: 'confirmed-fuzzy', strict_source: null,
        confirmed_at: '2026-04-21T00:00:00.000Z',
        last_seen_at: '2026-04-21T00:00:00.000Z',
      }],
      decisions: [],
      userId: 'u', now: NOW,
    });
    expect(result.crossBundles).toHaveLength(1);
    expect(result.crossBundles[0].linked[0].signal).toBe('confirmed-fuzzy');
    expect(result.strictLinksInferred).toEqual([]);
  });

  it('does not bundle a pair the user has dismissed, even when a strict signal fires', () => {
    const notifs = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/423', title: '[LIN-142] Add rate limits',
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-142/add-rate-limits', title: 'Add rate limits',
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const result = buildCrossBundles({
      notifications: notifs, pair: 'linear-github',
      workLinks: [],
      decisions: [{
        user_id: 'u', pair: 'linear-github',
        primary_key: 'LIN-142', linked_ref: 'o/r#423',
        decision: 'dismissed', decided_at: '2026-04-21T00:00:00.000Z',
      }],
      userId: 'u', now: Date.parse('2026-04-22T12:00:00.000Z'),
    });
    expect(result.crossBundles).toEqual([]);
    expect(result.strictLinksInferred).toEqual([]);
    expect([...result.consumedNotificationIds]).toEqual([]);
  });

  it('surfaces fuzzy candidates when no strict match is found', () => {
    const notifs = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/11', title: 'add rate limits to actions',
        author: { name: 'alice' }, updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-700/add-rate-limits', title: 'Add rate limits',
        author: { name: 'alice' }, updatedAt: '2026-04-22T09:00:00.000Z',
      }),
    ];
    const result = buildCrossBundles({
      notifications: notifs, pair: 'linear-github',
      workLinks: [], decisions: [],
      userId: 'u', now: NOW,
    });
    expect(result.crossBundles).toEqual([]);
    expect(result.fuzzyCandidates).toHaveLength(1);
    expect(result.fuzzyCandidates[0].confidence).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  it('emits only one cross-bundle when a PR body references two tickets', () => {
    const notifs = [
      notif({
        id: 'g', source: 'github',
        url: 'https://github.com/o/r/pull/9', title: 'multi-ticket PR',
        body: 'Closes LIN-1. Fixes LIN-2.',
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      notif({
        id: 'l1', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-1/x', title: 'x',
        updatedAt: '2026-04-22T09:00:00.000Z',
      }),
      notif({
        id: 'l2', source: 'linear',
        url: 'https://linear.app/t/issue/LIN-2/y', title: 'y',
        updatedAt: '2026-04-22T08:00:00.000Z',
      }),
    ];
    const result = buildCrossBundles({
      notifications: notifs, pair: 'linear-github',
      workLinks: [], decisions: [],
      userId: 'u', now: NOW,
    });
    expect(result.crossBundles).toHaveLength(1);
    const prOccurrences = result.crossBundles
      .flatMap((b) => b.children)
      .filter((c) => c.id === 'g').length;
    expect(prOccurrences).toBe(1);
  });
});
