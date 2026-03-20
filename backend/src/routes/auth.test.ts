import { beforeEach, describe, expect, it, vi } from 'vitest';
import auth from './auth';
import type { Env, Provider } from '../types';

interface MockOAuthState {
  state: string;
  user_id: string;
  provider: Provider;
  expires_at: string;
  consumed_at: string | null;
}

function createMockDb() {
  const usersByToken = new Map<string, { id: string; device_token: string }>();
  const oauthStates = new Map<string, MockOAuthState>();
  const insertedConnections: unknown[][] = [];

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM users WHERE device_token = ?')) {
            return usersByToken.get(params[0] as string) ?? null;
          }

          if (sql.includes('SELECT user_id, expires_at, consumed_at FROM oauth_states WHERE state = ? AND provider = ?')) {
            const state = oauthStates.get(params[0] as string);
            if (!state || state.provider !== params[1]) {
              return null;
            }

            return {
              user_id: state.user_id,
              expires_at: state.expires_at,
              consumed_at: state.consumed_at,
            };
          }

          return null;
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO oauth_states')) {
            const [state, userId, provider, expiresAt] = params as [string, string, Provider, string];
            oauthStates.set(state, {
              state,
              user_id: userId,
              provider,
              expires_at: expiresAt,
              consumed_at: null,
            });
          } else if (sql.includes('UPDATE oauth_states SET consumed_at')) {
            const state = oauthStates.get(params[0] as string);
            if (state && !state.consumed_at) {
              state.consumed_at = new Date().toISOString();
            }
          } else if (sql.includes('INSERT INTO connections')) {
            insertedConnections.push(params);
          }

          return {};
        }),
      }),
    })),
  } as unknown as D1Database;

  return {
    db,
    usersByToken,
    oauthStates,
    insertedConnections,
  };
}

function createEnv(db: D1Database): Env {
  return {
    DB: db,
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    LINEAR_CLIENT_ID: 'linear-client-id',
    LINEAR_CLIENT_SECRET: 'linear-client-secret',
    JIRA_CLIENT_ID: 'jira-client-id',
    JIRA_CLIENT_SECRET: 'jira-client-secret',
    BITBUCKET_CLIENT_ID: 'bitbucket-client-id',
    BITBUCKET_CLIENT_SECRET: 'bitbucket-client-secret',
    APP_URL: 'https://api.example.com',
    ENABLE_EXPERIMENTAL_PROVIDERS: 'false',
  };
}

describe('Auth routes', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  it('starts GitHub OAuth with authenticated /auth/github/start', async () => {
    const db = createMockDb();
    db.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(db.db);

    const response = await auth.request(
      '/github/start',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { url: string; expiresAt: string };
    expect(body.url).toContain('https://github.com/login/oauth/authorize');
    expect(body.url).toContain('state=');
    expect(body.expiresAt).toBeTruthy();
    expect(db.oauthStates.size).toBe(1);
  });

  it('starts Linear OAuth with authenticated /auth/linear/start', async () => {
    const db = createMockDb();
    db.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(db.db);

    const response = await auth.request(
      '/linear/start',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { url: string };
    expect(body.url).toContain('https://linear.app/oauth/authorize');
  });

  it('rejects /auth/github/start without auth header', async () => {
    const db = createMockDb();
    const env = createEnv(db.db);

    const response = await auth.request('/github/start', { method: 'POST' }, env);

    expect(response.status).toBe(401);
  });

  it('blocks Jira OAuth start when experimental providers are disabled', async () => {
    const db = createMockDb();
    db.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(db.db);
    env.ENABLE_EXPERIMENTAL_PROVIDERS = 'false';

    const response = await auth.request(
      '/jira/start',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(404);
  });

  it('allows Jira OAuth start when experimental providers are enabled', async () => {
    const db = createMockDb();
    db.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(db.db);
    env.ENABLE_EXPERIMENTAL_PROVIDERS = 'true';

    const response = await auth.request(
      '/jira/start',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json() as { url: string };
    expect(body.url).toContain('https://auth.atlassian.com/authorize');
  });

  it('rejects callback when OAuth state is missing or invalid', async () => {
    const db = createMockDb();
    const env = createEnv(db.db);

    const response = await auth.request('/github/callback?code=test-code&state=missing-state', {}, env);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Invalid or expired OAuth state');
  });

  it('rejects callback when OAuth state was already consumed', async () => {
    const db = createMockDb();
    const env = createEnv(db.db);
    const state = 'consumed-state';
    db.oauthStates.set(state, {
      state,
      user_id: 'user-1',
      provider: 'github',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      consumed_at: new Date().toISOString(),
    });

    const response = await auth.request(`/github/callback?code=test-code&state=${state}`, {}, env);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Invalid or expired OAuth state');
  });

  it('rejects callback when OAuth state is expired', async () => {
    const db = createMockDb();
    const env = createEnv(db.db);
    const state = 'expired-state';
    db.oauthStates.set(state, {
      state,
      user_id: 'user-1',
      provider: 'github',
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      consumed_at: null,
    });

    const response = await auth.request(`/github/callback?code=test-code&state=${state}`, {}, env);

    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toBe('Invalid or expired OAuth state');
  });

  it('consumes OAuth state and stores connection on successful callback', async () => {
    const db = createMockDb();
    const env = createEnv(db.db);
    const state = 'state-123';
    db.oauthStates.set(state, {
      state,
      user_id: 'user-1',
      provider: 'github',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      consumed_at: null,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42, login: 'octocat', avatar_url: 'https://example.com/avatar.png' }),
      });

    const response = await auth.request(`/github/callback?code=test-code&state=${state}`, {}, env);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('GitHub Connected!');
    expect(db.insertedConnections).toHaveLength(1);
    expect(db.oauthStates.get(state)?.consumed_at).toBeTruthy();
  });
});
