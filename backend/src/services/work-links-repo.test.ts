import { describe, it, expect } from 'vitest';
import type { WorkLink, SuggestionDecision, WorkLinkPair } from '../types';
import {
  loadUserLinkState,
  upsertWorkLink,
  upsertSuggestionDecision,
  touchWorkLinkLastSeen,
  clearDismissedSuggestions,
} from './work-links-repo';

// In-memory mock D1Database implementation mirroring the pattern used in
// notifications.test.ts. Supports only the statements this repo issues.
function createMockDb() {
  const workLinks: WorkLink[] = [];
  const suggestions: SuggestionDecision[] = [];
  return {
    _workLinks: workLinks,
    _suggestions: suggestions,
    prepare(sql: string) {
      let bound: unknown[] = [];
      const api = {
        bind(...args: unknown[]) { bound = args; return api; },
        async all<T = unknown>() {
          if (/FROM work_links/i.test(sql)) {
            const userId = bound[0] as string;
            return { results: workLinks.filter((w) => w.user_id === userId) as T[] };
          }
          if (/FROM suggestion_decisions/i.test(sql)) {
            const userId = bound[0] as string;
            return { results: suggestions.filter((s) => s.user_id === userId) as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          if (/INSERT INTO work_links/i.test(sql)) {
            const [user_id, pair, primary_key, linked_ref, signal, strict_source, confirmed_at, last_seen_at] = bound as [string, WorkLinkPair, string, string, 'strict'|'confirmed-fuzzy', string|null, string, string];
            const idx = workLinks.findIndex((w) =>
              w.user_id === user_id && w.pair === pair &&
              w.primary_key === primary_key && w.linked_ref === linked_ref
            );
            const row: WorkLink = { user_id, pair, primary_key, linked_ref, signal, strict_source: strict_source as WorkLink['strict_source'], confirmed_at, last_seen_at };
            if (idx >= 0) workLinks[idx] = row; else workLinks.push(row);
            return { success: true };
          }
          if (/UPDATE work_links SET last_seen_at/i.test(sql)) {
            const [last_seen_at, user_id, pair, primary_key, linked_ref] = bound as [string, string, WorkLinkPair, string, string];
            const row = workLinks.find((w) =>
              w.user_id === user_id && w.pair === pair &&
              w.primary_key === primary_key && w.linked_ref === linked_ref);
            if (row) row.last_seen_at = last_seen_at;
            return { success: true };
          }
          if (/INSERT INTO suggestion_decisions/i.test(sql)) {
            const [user_id, pair, primary_key, linked_ref, decision, decided_at] = bound as [string, WorkLinkPair, string, string, 'dismissed'|'confirmed', string];
            const idx = suggestions.findIndex((s) =>
              s.user_id === user_id && s.pair === pair &&
              s.primary_key === primary_key && s.linked_ref === linked_ref);
            const row: SuggestionDecision = { user_id, pair, primary_key, linked_ref, decision, decided_at };
            if (idx >= 0) suggestions[idx] = row; else suggestions.push(row);
            return { success: true };
          }
          if (/DELETE FROM suggestion_decisions WHERE user_id = \? AND decision = 'dismissed'/i.test(sql)) {
            const userId = bound[0] as string;
            for (let i = suggestions.length - 1; i >= 0; i--) {
              if (suggestions[i].user_id === userId && suggestions[i].decision === 'dismissed') {
                suggestions.splice(i, 1);
              }
            }
            return { success: true };
          }
          return { success: true };
        },
      };
      return api as unknown;
    },
  } as unknown as D1Database;
}

describe('work-links-repo', () => {
  it('loadUserLinkState returns empty arrays for a new user', async () => {
    const db = createMockDb();
    const { workLinks, decisions } = await loadUserLinkState(db, 'user-1');
    expect(workLinks).toEqual([]);
    expect(decisions).toEqual([]);
  });

  it('upsertWorkLink inserts once and updates on second call', async () => {
    const db = createMockDb();
    await upsertWorkLink(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      signal: 'strict', strict_source: 'title-prefix',
      confirmed_at: '2026-04-20T00:00:00.000Z', last_seen_at: '2026-04-20T00:00:00.000Z',
    });
    await upsertWorkLink(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      signal: 'strict', strict_source: 'title-prefix',
      confirmed_at: '2026-04-20T00:00:00.000Z', last_seen_at: '2026-04-22T00:00:00.000Z',
    });
    const { workLinks } = await loadUserLinkState(db, 'u');
    expect(workLinks).toHaveLength(1);
    expect(workLinks[0].last_seen_at).toBe('2026-04-22T00:00:00.000Z');
  });

  it('touchWorkLinkLastSeen updates only last_seen_at', async () => {
    const db = createMockDb();
    await upsertWorkLink(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      signal: 'strict', strict_source: 'title-prefix',
      confirmed_at: '2026-04-20T00:00:00.000Z', last_seen_at: '2026-04-20T00:00:00.000Z',
    });
    await touchWorkLinkLastSeen(db, 'u', 'linear-github', 'LIN-1', 'r/p#1', '2026-04-23T00:00:00.000Z');
    const { workLinks } = await loadUserLinkState(db, 'u');
    expect(workLinks[0].last_seen_at).toBe('2026-04-23T00:00:00.000Z');
    expect(workLinks[0].confirmed_at).toBe('2026-04-20T00:00:00.000Z');
  });

  it('upsertSuggestionDecision persists and is retrievable', async () => {
    const db = createMockDb();
    await upsertSuggestionDecision(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      decision: 'dismissed', decided_at: '2026-04-22T00:00:00.000Z',
    });
    const { decisions } = await loadUserLinkState(db, 'u');
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision).toBe('dismissed');
  });

  it('clearDismissedSuggestions removes only dismissed rows for the user', async () => {
    const db = createMockDb();
    await upsertSuggestionDecision(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      decision: 'dismissed', decided_at: '2026-04-22T00:00:00.000Z',
    });
    await upsertSuggestionDecision(db, {
      user_id: 'u', pair: 'linear-github', primary_key: 'LIN-2', linked_ref: 'r/p#2',
      decision: 'confirmed', decided_at: '2026-04-22T00:00:00.000Z',
    });
    await clearDismissedSuggestions(db, 'u');
    const { decisions } = await loadUserLinkState(db, 'u');
    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision).toBe('confirmed');
  });

  it('loadUserLinkState scopes to user_id', async () => {
    const db = createMockDb();
    await upsertWorkLink(db, {
      user_id: 'u1', pair: 'linear-github', primary_key: 'LIN-1', linked_ref: 'r/p#1',
      signal: 'strict', strict_source: 'title-prefix',
      confirmed_at: '2026-04-20T00:00:00.000Z', last_seen_at: '2026-04-20T00:00:00.000Z',
    });
    const { workLinks } = await loadUserLinkState(db, 'u2');
    expect(workLinks).toEqual([]);
  });
});
