import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import links from './links';
import type { Env, Variables } from '../types';

const MOCK_TOKEN = 'test-device-token';
const MOCK_USER = {
  id: 'u1',
  device_token: MOCK_TOKEN,
  created_at: '2026-04-22T00:00:00Z',
  updated_at: '2026-04-22T00:00:00Z',
};

function createMockDb() {
  const workLinks: unknown[][] = [];
  const suggestions: unknown[][] = [];

  function makeStmt(sql: string) {
    let bound: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) { bound = args; return stmt; },
      async first() {
        if (/SELECT \* FROM users WHERE device_token = \?/i.test(sql)) {
          return bound[0] === MOCK_TOKEN ? MOCK_USER : null;
        }
        return null;
      },
      async run() {
        if (/INSERT INTO work_links/i.test(sql)) workLinks.push(bound);
        if (/INSERT INTO suggestion_decisions/i.test(sql)) suggestions.push(bound);
        if (/DELETE FROM suggestion_decisions/i.test(sql)) {
          for (let i = suggestions.length - 1; i >= 0; i--) {
            const row = suggestions[i] as unknown[];
            if (row[0] === bound[0] && row[4] === 'dismissed') suggestions.splice(i, 1);
          }
        }
        return { success: true };
      },
      async all() { return { results: [] }; },
    };
    return stmt;
  }

  return {
    _workLinks: workLinks,
    _suggestions: suggestions,
    prepare(sql: string) { return makeStmt(sql); },
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of stmts) results.push(await s.run());
      return results;
    },
  } as unknown as D1Database;
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${MOCK_TOKEN}`,
};

function buildApp(db: D1Database): Hono<{ Bindings: Env; Variables: Variables }> {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.route('/notifications/links', links);
  return app;
}

const baseEnv: Partial<Env> = {
  GITHUB_CLIENT_ID: '',
  GITHUB_CLIENT_SECRET: '',
  LINEAR_CLIENT_ID: '',
  LINEAR_CLIENT_SECRET: '',
  JIRA_CLIENT_ID: '',
  JIRA_CLIENT_SECRET: '',
  BITBUCKET_CLIENT_ID: '',
  BITBUCKET_CLIENT_SECRET: '',
  APP_URL: 'http://localhost',
};

describe('POST /notifications/links/confirm', () => {
  it('writes to work_links and suggestion_decisions', async () => {
    const db = createMockDb();
    const app = buildApp(db);
    const res = await app.request(
      '/notifications/links/confirm',
      {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          pair: 'linear-github',
          primary_key: 'LIN-142',
          linked_ref: 'o/r#423',
        }),
      },
      { ...baseEnv, DB: db } as Env,
    );
    expect(res.status).toBe(200);
    expect((db as unknown as { _workLinks: unknown[] })._workLinks).toHaveLength(1);
    expect((db as unknown as { _suggestions: unknown[] })._suggestions).toHaveLength(1);
  });

  it('returns 400 for missing or invalid fields', async () => {
    const db = createMockDb();
    const app = buildApp(db);
    const res = await app.request(
      '/notifications/links/confirm',
      {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ pair: 'not-a-pair' }),
      },
      { ...baseEnv, DB: db } as Env,
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /notifications/links/dismiss', () => {
  it('writes a dismissed decision', async () => {
    const db = createMockDb();
    const app = buildApp(db);
    const res = await app.request(
      '/notifications/links/dismiss',
      {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          pair: 'jira-bitbucket',
          primary_key: 'ABC-78',
          linked_ref: 'ws/r#42',
        }),
      },
      { ...baseEnv, DB: db } as Env,
    );
    expect(res.status).toBe(200);
    expect((db as unknown as { _suggestions: unknown[] })._suggestions).toHaveLength(1);
  });
});

describe('POST /notifications/links/clear-dismissed', () => {
  it('removes only dismissed rows', async () => {
    const db = createMockDb();
    const sugs = (db as unknown as { _suggestions: unknown[][] })._suggestions;
    sugs.push(['u1', 'linear-github', 'LIN-1', 'r/p#1', 'dismissed', '2026-04-22']);
    sugs.push(['u1', 'linear-github', 'LIN-2', 'r/p#2', 'confirmed', '2026-04-22']);
    const app = buildApp(db);
    const res = await app.request(
      '/notifications/links/clear-dismissed',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${MOCK_TOKEN}` },
      },
      { ...baseEnv, DB: db } as Env,
    );
    expect(res.status).toBe(200);
    // The mock regex filters on bound[0] === 'u1' and row[4] === 'dismissed'.
    expect(sugs).toHaveLength(1);
    expect((sugs[0] as unknown[])[4]).toBe('confirmed');
  });
});
