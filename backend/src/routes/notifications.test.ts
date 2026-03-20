import { beforeEach, describe, expect, it, vi } from 'vitest';
import notifications from './notifications';
import type { Env } from '../types';

function createMockDb() {
  const usersByToken = new Map<string, { id: string; device_token: string }>();

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM users WHERE device_token = ?')) {
            return usersByToken.get(params[0] as string) ?? null;
          }

          // Default to "not connected" for provider connection lookups.
          return null;
        }),
      }),
    })),
  } as unknown as D1Database;

  return {
    db,
    usersByToken,
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

describe('Notifications route provider gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for /notifications/jira when experimental providers are disabled', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/jira',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 for /notifications/bitbucket when experimental providers are disabled', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/bitbucket',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer device-token-1',
        },
      },
      env
    );

    expect(response.status).toBe(404);
  });

  it('returns 404 when marking all Jira notifications as read while experimental providers are disabled', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/read-all',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: 'jira' }),
      },
      env
    );

    expect(response.status).toBe(404);
  });
});
