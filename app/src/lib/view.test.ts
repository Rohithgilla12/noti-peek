import { describe, it, expect } from 'vitest';
import type { Notification } from './types';
import {
  matchesView,
  countForScope,
  countForQuickFilter,
  countForSource,
  DEFAULT_VIEW,
} from './view';

function n(o: Partial<Notification> & Pick<Notification, 'id' | 'source' | 'type' | 'unread'>): Notification {
  return {
    title: 't',
    url: 'u',
    author: { name: 'a' },
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T10:00:00.000Z',
    ...o,
  };
}

describe('matchesView — scope', () => {
  it('Inbox excludes archived', () => {
    const arch = n({ id: '1', source: 'github', type: 'pr', unread: true, archived: true });
    const live = n({ id: '2', source: 'github', type: 'pr', unread: true });
    expect(matchesView(arch, { ...DEFAULT_VIEW, scope: 'inbox' })).toBe(false);
    expect(matchesView(live, { ...DEFAULT_VIEW, scope: 'inbox' })).toBe(true);
  });

  it('Archive only includes archived', () => {
    const arch = n({ id: '1', source: 'github', type: 'pr', unread: true, archived: true });
    const live = n({ id: '2', source: 'github', type: 'pr', unread: true });
    expect(matchesView(arch, { ...DEFAULT_VIEW, scope: 'archive' })).toBe(true);
    expect(matchesView(live, { ...DEFAULT_VIEW, scope: 'archive' })).toBe(false);
  });

  it('Bookmarks only includes bookmarked', () => {
    const b = n({ id: '1', source: 'github', type: 'pr', unread: true, bookmarked: true });
    const p = n({ id: '2', source: 'github', type: 'pr', unread: true });
    expect(matchesView(b, { ...DEFAULT_VIEW, scope: 'bookmarks' })).toBe(true);
    expect(matchesView(p, { ...DEFAULT_VIEW, scope: 'bookmarks' })).toBe(false);
  });

  it('Mentions includes mentioned and review_requested, excludes archived', () => {
    const m = n({ id: '1', source: 'github', type: 'mentioned', unread: true });
    const r = n({ id: '2', source: 'github', type: 'review_requested', unread: true });
    const p = n({ id: '3', source: 'github', type: 'pr', unread: true });
    const ma = n({ id: '4', source: 'github', type: 'mentioned', unread: true, archived: true });
    expect(matchesView(m, { ...DEFAULT_VIEW, scope: 'mentions' })).toBe(true);
    expect(matchesView(r, { ...DEFAULT_VIEW, scope: 'mentions' })).toBe(true);
    expect(matchesView(p, { ...DEFAULT_VIEW, scope: 'mentions' })).toBe(false);
    expect(matchesView(ma, { ...DEFAULT_VIEW, scope: 'mentions' })).toBe(false);
  });
});

describe('matchesView — quick filters', () => {
  it('Unread filter restricts to unread', () => {
    const u = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const r = n({ id: '2', source: 'github', type: 'pr', unread: false });
    const v = { ...DEFAULT_VIEW, scope: 'inbox' as const, filters: new Set(['unread'] as const) };
    expect(matchesView(u, v)).toBe(true);
    expect(matchesView(r, v)).toBe(false);
  });

  it('PRs filter matches pr, review, review_requested', () => {
    const cases: Array<[string, boolean]> = [
      ['pr', true],
      ['review', true],
      ['review_requested', true],
      ['mentioned', false],
      ['comment', false],
    ];
    const v = { ...DEFAULT_VIEW, scope: 'inbox' as const, filters: new Set(['prs'] as const) };
    for (const [type, expected] of cases) {
      const notif = n({ id: type, source: 'github', type, unread: true });
      expect(matchesView(notif, v)).toBe(expected);
    }
  });

  it('Errors filter never matches any notification row (it renders synthetic cards elsewhere)', () => {
    const u = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const v = { ...DEFAULT_VIEW, scope: 'inbox' as const, filters: new Set(['errors'] as const) };
    expect(matchesView(u, v)).toBe(false);
  });

  it('Multiple quick filters AND-compose', () => {
    const unreadPr = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const readPr = n({ id: '2', source: 'github', type: 'pr', unread: false });
    const unreadComment = n({ id: '3', source: 'github', type: 'comment', unread: true });
    const v = {
      ...DEFAULT_VIEW,
      scope: 'inbox' as const,
      filters: new Set(['unread', 'prs'] as const),
    };
    expect(matchesView(unreadPr, v)).toBe(true);
    expect(matchesView(readPr, v)).toBe(false);
    expect(matchesView(unreadComment, v)).toBe(false);
  });
});

describe('matchesView — sources', () => {
  it('Empty sources set matches all providers', () => {
    const gh = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const lr = n({ id: '2', source: 'linear', type: 'issue', unread: true });
    expect(matchesView(gh, DEFAULT_VIEW)).toBe(true);
    expect(matchesView(lr, DEFAULT_VIEW)).toBe(true);
  });

  it('Non-empty sources set restricts to members', () => {
    const gh = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const lr = n({ id: '2', source: 'linear', type: 'issue', unread: true });
    const v = { ...DEFAULT_VIEW, sources: new Set(['linear'] as const) };
    expect(matchesView(gh, v)).toBe(false);
    expect(matchesView(lr, v)).toBe(true);
  });

  it('Multi-provider selection is a union', () => {
    const gh = n({ id: '1', source: 'github', type: 'pr', unread: true });
    const lr = n({ id: '2', source: 'linear', type: 'issue', unread: true });
    const ji = n({ id: '3', source: 'jira', type: 'issue', unread: true });
    const v = { ...DEFAULT_VIEW, sources: new Set(['github', 'linear'] as const) };
    expect(matchesView(gh, v)).toBe(true);
    expect(matchesView(lr, v)).toBe(true);
    expect(matchesView(ji, v)).toBe(false);
  });
});

describe('sidebar counts use the unfiltered corpus', () => {
  const corpus = [
    n({ id: '1', source: 'github', type: 'pr', unread: true }),
    n({ id: '2', source: 'github', type: 'pr', unread: false, bookmarked: true }),
    n({ id: '3', source: 'linear', type: 'issue', unread: true, archived: true }),
    n({ id: '4', source: 'github', type: 'mentioned', unread: true }),
  ];

  it('countForScope ignores current view selection', () => {
    expect(countForScope(corpus, 'inbox')).toBe(3);      // everything except #3 (archived)
    expect(countForScope(corpus, 'archive')).toBe(1);
    expect(countForScope(corpus, 'bookmarks')).toBe(1);
    expect(countForScope(corpus, 'mentions')).toBe(1);
  });

  it('countForQuickFilter counts across unfiltered corpus', () => {
    expect(countForQuickFilter(corpus, 'unread')).toBe(3);
    expect(countForQuickFilter(corpus, 'prs')).toBe(2);
  });

  it('countForSource counts across unfiltered corpus', () => {
    expect(countForSource(corpus, 'github')).toBe(3);
    expect(countForSource(corpus, 'linear')).toBe(1);
    expect(countForSource(corpus, 'jira')).toBe(0);
  });
});
