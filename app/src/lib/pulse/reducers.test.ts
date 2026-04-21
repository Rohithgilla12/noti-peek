import { describe, it, expect } from 'vitest';
import {
  volumeStats,
  hourBuckets,
  sourceBreakdown,
  topActors,
  topRepos,
} from './reducers';
import type { Notification } from '../types';

function n(partial: Partial<Notification> & { id: string; firstSeenAt: string }): Notification & { firstSeenAt: string } {
  return {
    id: partial.id,
    source: partial.source ?? 'github',
    type: partial.type ?? 'PullRequest',
    title: partial.title ?? 'x',
    url: partial.url ?? 'https://example',
    repo: partial.repo,
    project: partial.project,
    author: partial.author ?? { name: 'alice' },
    unread: partial.unread ?? false,
    createdAt: partial.createdAt ?? partial.firstSeenAt,
    updatedAt: partial.updatedAt ?? partial.firstSeenAt,
    firstSeenAt: partial.firstSeenAt,
  } as Notification & { firstSeenAt: string };
}

describe('volumeStats', () => {
  it('returns 0 today and 0 avg on empty input', () => {
    const r = volumeStats([], new Date('2026-04-21T12:00:00Z'));
    expect(r.volumeToday).toBe(0);
    expect(r.volumeAvg30).toBe(0);
  });

  it('counts rows whose first_seen_at falls in the local today window', () => {
    const now = new Date('2026-04-21T12:00:00Z');
    const rows = [
      n({ id: '1', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '2', firstSeenAt: '2026-04-21T23:30:00Z' }),
      n({ id: '3', firstSeenAt: '2026-04-20T23:00:00Z' }),
    ];
    const r = volumeStats(rows, now);
    expect(r.volumeToday).toBe(2);
  });

  it('computes 30-day daily average rounded', () => {
    const now = new Date('2026-04-21T00:00:00Z');
    const rows = Array.from({ length: 60 }, (_, i) =>
      n({ id: String(i), firstSeenAt: new Date(now.getTime() - i * 86_400_000 / 2).toISOString() }),
    );
    const r = volumeStats(rows, now);
    expect(r.volumeAvg30).toBe(2);
  });
});

describe('hourBuckets', () => {
  it('returns length 24 even with sparse data', () => {
    const buckets = hourBuckets([n({ id: '1', firstSeenAt: '2026-04-21T03:00:00Z' })]);
    expect(buckets).toHaveLength(24);
  });

  it('accumulates counts per local hour-of-day', () => {
    const rows = [
      n({ id: '1', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '2', firstSeenAt: '2026-04-21T03:30:00Z' }),
      n({ id: '3', firstSeenAt: '2026-04-21T14:00:00Z' }),
    ];
    const b = hourBuckets(rows);
    const hourOfRow1 = new Date('2026-04-21T03:00:00Z').getHours();
    const hourOfRow3 = new Date('2026-04-21T14:00:00Z').getHours();
    expect(b[hourOfRow1]).toBe(2);
    expect(b[hourOfRow3]).toBe(1);
  });
});

describe('sourceBreakdown', () => {
  it('returns counts and percentages per source, ordered by count desc', () => {
    const rows = [
      n({ id: '1', source: 'github', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '2', source: 'github', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '3', source: 'linear', firstSeenAt: '2026-04-21T03:00:00Z' }),
    ];
    const r = sourceBreakdown(rows);
    expect(r).toEqual([
      { source: 'github', count: 2, pct: 67 },
      { source: 'linear', count: 1, pct: 33 },
    ]);
  });

  it('returns empty array on empty input', () => {
    expect(sourceBreakdown([])).toEqual([]);
  });
});

describe('topActors', () => {
  it('returns top 5 authors by count, stable on ties via name', () => {
    const rows = [
      n({ id: '1', author: { name: 'alice' }, firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '2', author: { name: 'alice' }, firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '3', author: { name: 'bob' }, firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '4', author: { name: 'carol' }, firstSeenAt: '2026-04-21T03:00:00Z' }),
    ];
    const r = topActors(rows, 5);
    expect(r[0]).toMatchObject({ name: 'alice', count: 2 });
    expect(r).toHaveLength(3);
  });

  it('caps to the limit and drops overflow', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      n({ id: String(i), author: { name: `u${i}` }, firstSeenAt: '2026-04-21T03:00:00Z' }),
    );
    expect(topActors(rows, 3)).toHaveLength(3);
  });
});

describe('topRepos', () => {
  it('uses repo; falls back to project; ignores rows with neither', () => {
    const rows = [
      n({ id: '1', repo: 'monorepo', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '2', project: 'platform', firstSeenAt: '2026-04-21T03:00:00Z' }),
      n({ id: '3', firstSeenAt: '2026-04-21T03:00:00Z' }),
    ];
    const r = topRepos(rows, 5);
    const names = r.map((x) => x.repo);
    expect(names).toContain('monorepo');
    expect(names).toContain('platform');
    expect(names).not.toContain('');
  });
});
