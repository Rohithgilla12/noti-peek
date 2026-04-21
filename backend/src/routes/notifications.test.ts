import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection, Env } from '../types';
import { InsufficientScopeError, TokenExpiredError } from '../types';

const {
  fetchPRDetailsMock,
  fetchIssueDetailsMock,
  postIssueCommentMock,
  setIssueStateMock,
  submitPRReviewMock,
  mergePRMock,
  fetchJiraIssueDetailsMock,
  postJiraCommentMock,
  transitionJiraIssueMock,
  assignJiraSelfMock,
} = vi.hoisted(() => ({
  fetchPRDetailsMock: vi.fn(),
  fetchIssueDetailsMock: vi.fn(),
  postIssueCommentMock: vi.fn(),
  setIssueStateMock: vi.fn(),
  submitPRReviewMock: vi.fn(),
  mergePRMock: vi.fn(),
  fetchJiraIssueDetailsMock: vi.fn(),
  postJiraCommentMock: vi.fn(),
  transitionJiraIssueMock: vi.fn(),
  assignJiraSelfMock: vi.fn(),
}));

vi.mock('../services/github-detail', () => ({
  fetchPRDetails: fetchPRDetailsMock,
  fetchIssueDetails: fetchIssueDetailsMock,
  postIssueComment: postIssueCommentMock,
  setIssueState: setIssueStateMock,
  submitPRReview: submitPRReviewMock,
  mergePR: mergePRMock,
}));

vi.mock('../services/jira-detail', async () => {
  const actual = await vi.importActual<typeof import('../services/jira-detail')>('../services/jira-detail');
  return {
    // Keep the real URL parser so route-level URL validation still works.
    parseJiraIssueUrl: actual.parseJiraIssueUrl,
    fetchJiraIssueDetails: fetchJiraIssueDetailsMock,
    postJiraComment: postJiraCommentMock,
    transitionJiraIssue: transitionJiraIssueMock,
    assignJiraSelf: assignJiraSelfMock,
  };
});

import notifications from './notifications';

type ConnectionKey = `${string}:${string}`;

function createMockDb() {
  const usersByToken = new Map<string, { id: string; device_token: string }>();
  const connectionsByUserProvider = new Map<ConnectionKey, Connection>();

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM users WHERE device_token = ?')) {
            return usersByToken.get(params[0] as string) ?? null;
          }

          if (sql.includes('SELECT * FROM connections WHERE user_id = ? AND provider = ?')) {
            const key = `${params[0] as string}:${params[1] as string}` as ConnectionKey;
            return connectionsByUserProvider.get(key) ?? null;
          }

          return null;
        }),
      }),
    })),
  } as unknown as D1Database;

  return {
    db,
    usersByToken,
    connectionsByUserProvider,
  };
}

function seedConnection(
  mockDb: ReturnType<typeof createMockDb>,
  userId: string,
  provider: 'github' | 'jira',
): Connection {
  const conn: Connection = {
    id: `conn-${provider}`,
    user_id: userId,
    provider,
    access_token: 'tok',
    refresh_token: 'refresh',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    account_id: 'acc',
    account_name: 'me',
    account_avatar: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockDb.connectionsByUserProvider.set(`${userId}:${provider}` as ConnectionKey, conn);
  return conn;
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

  it('returns bundling_version and rows in the envelope by default', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json<{
      notifications: unknown[];
      rows: unknown[] | undefined;
      bundling_version: number | undefined;
    }>();
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.bundling_version).toBe(1);
  });

  it('omits bundling fields when ?bundle=false is passed', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/?bundle=false',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env
    );

    expect(response.status).toBe(200);
    const body = await response.json<{
      notifications: unknown[];
      rows: unknown;
      bundling_version: unknown;
    }>();
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(body.rows).toBeUndefined();
    expect(body.bundling_version).toBeUndefined();
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

describe('Notifications detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when url query param is missing', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:123/details',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toContain('url');
  });

  it('returns 400 when id prefix is unknown', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/weird:123/details?url=https%3A%2F%2Fexample.com',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('unknown notification source');
  });

  it('returns 403 insufficient_scope envelope when GitHub service throws', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    fetchPRDetailsMock.mockRejectedValueOnce(
      new InsufficientScopeError('missing scope', 'github'),
    );

    const url = encodeURIComponent('https://github.com/a/b/pull/1');
    const response = await notifications.request(
      `/github:X/details?url=${url}`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env,
    );

    expect(response.status).toBe(403);
    const body = await response.json<{ error: string; reconnectUrl: string; reconnectProvider: string }>();
    expect(body).toEqual({
      error: 'insufficient_scope',
      reconnectUrl: '/auth/github/start',
      reconnectProvider: 'github',
    });
  });

  it('returns 403 insufficient_scope envelope when Jira service throws', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'jira');
    const env = { ...createEnv(mockDb.db), ENABLE_EXPERIMENTAL_PROVIDERS: 'true' };

    fetchJiraIssueDetailsMock.mockRejectedValueOnce(
      new InsufficientScopeError('missing scope', 'jira'),
    );

    const url = encodeURIComponent('https://acme.atlassian.net/browse/A-1');
    const response = await notifications.request(
      `/jira:X/details?url=${url}`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env,
    );

    expect(response.status).toBe(403);
    const body = await response.json<{ error: string; reconnectUrl: string; reconnectProvider: string }>();
    expect(body).toEqual({
      error: 'insufficient_scope',
      reconnectUrl: '/auth/jira/start',
      reconnectProvider: 'jira',
    });
  });

  it('returns 401 token_expired envelope when Jira service throws TokenExpiredError', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'jira');
    const env = { ...createEnv(mockDb.db), ENABLE_EXPERIMENTAL_PROVIDERS: 'true' };

    fetchJiraIssueDetailsMock.mockRejectedValueOnce(new TokenExpiredError('expired'));

    const url = encodeURIComponent('https://acme.atlassian.net/browse/A-1');
    const response = await notifications.request(
      `/jira:X/details?url=${url}`,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env,
    );

    expect(response.status).toBe(401);
    const body = await response.json<{ error: string; reconnectUrl: string; reconnectProvider: string }>();
    expect(body).toEqual({
      error: 'token_expired',
      reconnectUrl: '/auth/jira/start',
      reconnectProvider: 'jira',
    });
  });
});

describe('Notifications actions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function baseRequest(path: string, body: unknown): Request {
    return new Request(`http://local${path.startsWith('/') ? path : `/${path}`}`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer device-token-1',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it('returns 400 when request body is missing', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/comment',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer device-token-1' },
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('url required in body');
  });

  it('returns 400 when url missing from body', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/comment',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: 'hi' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('url required in body');
  });

  it('returns 400 for an unknown github action', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:x/actions/fly',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/pull/1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('unknown github action: fly');
  });

  it('returns 400 for an unknown jira action', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'jira');
    const env = { ...createEnv(mockDb.db), ENABLE_EXPERIMENTAL_PROVIDERS: 'true' };

    const response = await notifications.request(
      '/jira:x/actions/teleport',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://acme.atlassian.net/browse/A-1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('unknown jira action: teleport');
  });

  it('returns 400 when comment action has no body', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/comment',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/issues/1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('body required');
  });

  it('returns 400 when request_changes on a PR has no body', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/request_changes',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/pull/1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('body required for request_changes');
  });

  it('returns 400 when transition has no transitionId', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'jira');
    const env = { ...createEnv(mockDb.db), ENABLE_EXPERIMENTAL_PROVIDERS: 'true' };

    const response = await notifications.request(
      '/jira:1/actions/transition',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://acme.atlassian.net/browse/A-1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('transitionId required');
  });

  it('returns 400 when approve is sent on an issue URL (kind mismatch)', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/approve',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/issues/1' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('approve only valid on PRs');
  });

  it('returns 400 when github connection is missing', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    const env = createEnv(mockDb.db);

    const response = await notifications.request(
      '/github:1/actions/comment',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/issues/1', body: 'hi' }),
      },
      env,
    );

    expect(response.status).toBe(400);
    const body = await response.json<{ error: string }>();
    expect(body.error).toBe('GitHub not connected');
  });

  it('returns 403 insufficient_scope envelope when github service throws', async () => {
    const mockDb = createMockDb();
    mockDb.usersByToken.set('device-token-1', { id: 'user-1', device_token: 'device-token-1' });
    seedConnection(mockDb, 'user-1', 'github');
    const env = createEnv(mockDb.db);

    postIssueCommentMock.mockRejectedValueOnce(
      new InsufficientScopeError('missing scope', 'github'),
    );

    const response = await notifications.request(
      '/github:1/actions/comment',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer device-token-1',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://github.com/a/b/issues/1', body: 'hi' }),
      },
      env,
    );

    expect(response.status).toBe(403);
    const body = await response.json<{
      success: boolean;
      error: string;
      reconnectUrl: string;
      reconnectProvider: string;
    }>();
    expect(body).toEqual({
      success: false,
      error: 'insufficient_scope',
      reconnectUrl: '/auth/github/start',
      reconnectProvider: 'github',
    });
  });
});
