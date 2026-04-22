import { Hono } from 'hono';
import type { Env, Variables, Provider } from '../types';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthStateRow {
  user_id: string;
  expires_at: string;
  consumed_at: string | null;
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function cleanupOAuthStates(db: D1Database): Promise<void> {
  const nowIso = new Date().toISOString();
  await db.prepare(
    'DELETE FROM oauth_states WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND consumed_at <= datetime("now", "-1 day"))'
  ).bind(nowIso).run();
}

async function createOAuthState(
  db: D1Database,
  userId: string,
  provider: Provider
): Promise<{ state: string; expiresAt: string }> {
  const state = generateId();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

  await db.prepare(
    'INSERT INTO oauth_states (state, user_id, provider, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(state, userId, provider, expiresAt).run();

  return { state, expiresAt };
}

async function consumeOAuthState(
  db: D1Database,
  state: string,
  provider: Provider
): Promise<string | null> {
  const stateRow = await db.prepare(
    'SELECT user_id, expires_at, consumed_at FROM oauth_states WHERE state = ? AND provider = ?'
  ).bind(state, provider).first<OAuthStateRow>();

  if (!stateRow || stateRow.consumed_at) {
    return null;
  }

  if (new Date(stateRow.expires_at).getTime() <= Date.now()) {
    return null;
  }

  await db.prepare(
    'UPDATE oauth_states SET consumed_at = CURRENT_TIMESTAMP WHERE state = ? AND consumed_at IS NULL'
  ).bind(state).run();

  return stateRow.user_id;
}

function getProviderConnectedHtml(providerName: string): string {
  return `
    <html>
      <body>
        <h1>${providerName} Connected!</h1>
        <p>You can close this window and return to noti-peek.</p>
        <script>window.close();</script>
      </body>
    </html>
  `;
}

function providerEnabled(env: Env, provider: Provider): boolean {
  if (provider === 'jira' || provider === 'bitbucket') {
    return env.ENABLE_EXPERIMENTAL_PROVIDERS === 'true';
  }

  return true;
}

auth.post('/register', async (c) => {
  const id = generateId();
  const deviceToken = generateDeviceToken();

  await c.env.DB.prepare(
    'INSERT INTO users (id, device_token) VALUES (?, ?)'
  ).bind(id, deviceToken).run();

  return c.json({
    id,
    deviceToken,
  });
});

auth.post('/verify', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({
    valid: true,
    userId: user.id,
  });
});

auth.get('/github', async (c) => {
  return c.json({ error: 'Deprecated endpoint. Use POST /auth/github/start.' }, 410);
});

auth.post('/github/start', authMiddleware, async (c) => {
  const user = c.get('user');
  await cleanupOAuthStates(c.env.DB);

  const { state, expiresAt } = await createOAuthState(c.env.DB, user.id, 'github');
  const redirectUri = `${c.env.APP_URL}/auth/github/callback`;

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', c.env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'notifications read:user repo');
  url.searchParams.set('state', state);

  return c.json({
    url: url.toString(),
    expiresAt,
  });
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const userId = await consumeOAuthState(c.env.DB, state, 'github');
  if (!userId) {
    return c.json({ error: 'Invalid or expired OAuth state' }, 400);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as OAuthTokenResponse;

  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange code for token', details: tokenData.error }, 400);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'User-Agent': 'noti-peek',
    },
  });

  const userData = await userResponse.json() as { id: number; login: string; avatar_url: string };

  const connectionId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO connections (id, user_id, provider, access_token, account_id, account_name, account_avatar)
    VALUES (?, ?, 'github', ?, ?, ?, ?)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = excluded.access_token,
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      account_avatar = excluded.account_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    userId,
    tokenData.access_token,
    String(userData.id),
    userData.login,
    userData.avatar_url
  ).run();

  return c.html(getProviderConnectedHtml('GitHub'));
});

auth.delete('/github', authMiddleware, async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'github').run();

  return c.json({ success: true });
});

auth.post('/github/token', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ token: string }>();

  if (!body.token) {
    return c.json({ error: 'Missing token' }, 400);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${body.token}`,
      'User-Agent': 'noti-peek',
    },
  });

  if (!userResponse.ok) {
    return c.json({ error: 'Invalid GitHub token' }, 401);
  }

  const userData = await userResponse.json() as { id: number; login: string; avatar_url: string };

  const connectionId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO connections (id, user_id, provider, access_token, account_id, account_name, account_avatar)
    VALUES (?, ?, 'github', ?, ?, ?, ?)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = excluded.access_token,
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      account_avatar = excluded.account_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    user.id,
    body.token,
    String(userData.id),
    userData.login,
    userData.avatar_url
  ).run();

  return c.json({
    success: true,
    accountName: userData.login,
    accountAvatar: userData.avatar_url,
  });
});

auth.get('/linear', async (c) => {
  return c.json({ error: 'Deprecated endpoint. Use POST /auth/linear/start.' }, 410);
});

auth.post('/linear/start', authMiddleware, async (c) => {
  const user = c.get('user');
  await cleanupOAuthStates(c.env.DB);

  const { state, expiresAt } = await createOAuthState(c.env.DB, user.id, 'linear');
  const redirectUri = `${c.env.APP_URL}/auth/linear/callback`;

  const url = new URL('https://linear.app/oauth/authorize');
  url.searchParams.set('client_id', c.env.LINEAR_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return c.json({
    url: url.toString(),
    expiresAt,
  });
});

auth.get('/linear/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const userId = await consumeOAuthState(c.env.DB, state, 'linear');
  if (!userId) {
    return c.json({ error: 'Invalid or expired OAuth state' }, 400);
  }
  const redirectUri = `${c.env.APP_URL}/auth/linear/callback`;

  const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: c.env.LINEAR_CLIENT_ID,
      client_secret: c.env.LINEAR_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as OAuthTokenResponse;

  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange code for token', details: tokenData.error }, 400);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const userResponse = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': tokenData.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `{ viewer { id name email avatarUrl } }`,
    }),
  });

  const userResult = await userResponse.json() as { data?: { viewer: { id: string; name: string; avatarUrl: string } } };
  const userData = userResult.data?.viewer;

  const connectionId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO connections (id, user_id, provider, access_token, refresh_token, token_expires_at, account_id, account_name, account_avatar)
    VALUES (?, ?, 'linear', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      account_avatar = excluded.account_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    userId,
    tokenData.access_token,
    tokenData.refresh_token ?? null,
    expiresAt,
    userData?.id ?? null,
    userData?.name ?? null,
    userData?.avatarUrl ?? null
  ).run();

  return c.html(getProviderConnectedHtml('Linear'));
});

auth.delete('/linear', authMiddleware, async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'linear').run();

  return c.json({ success: true });
});

// Jira OAuth routes
auth.get('/jira', async (c) => {
  if (!providerEnabled(c.env, 'jira')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  return c.json({ error: 'Deprecated endpoint. Use POST /auth/jira/start.' }, 410);
});

auth.post('/jira/start', authMiddleware, async (c) => {
  if (!providerEnabled(c.env, 'jira')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  const user = c.get('user');
  await cleanupOAuthStates(c.env.DB);

  const { state, expiresAt } = await createOAuthState(c.env.DB, user.id, 'jira');
  const redirectUri = `${c.env.APP_URL}/auth/jira/callback`;

  const url = new URL('https://auth.atlassian.com/authorize');
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', c.env.JIRA_CLIENT_ID);
  url.searchParams.set('scope', 'read:jira-work read:jira-user write:jira-work offline_access');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');

  return c.json({
    url: url.toString(),
    expiresAt,
  });
});

auth.get('/jira/callback', async (c) => {
  if (!providerEnabled(c.env, 'jira')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const userId = await consumeOAuthState(c.env.DB, state, 'jira');
  if (!userId) {
    return c.json({ error: 'Invalid or expired OAuth state' }, 400);
  }
  const redirectUri = `${c.env.APP_URL}/auth/jira/callback`;

  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: c.env.JIRA_CLIENT_ID,
      client_secret: c.env.JIRA_CLIENT_SECRET,
      redirect_uri: redirectUri,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as OAuthTokenResponse;

  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange code for token', details: tokenData.error }, 400);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Get accessible resources to find the cloud ID and site name
  const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
    },
  });

  const resources = await resourcesResponse.json() as Array<{ id: string; name: string; url: string; avatarUrl?: string }>;
  const primaryResource = resources[0];

  // Get user info
  const userResponse = await fetch('https://api.atlassian.com/me', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
    },
  });

  const userData = await userResponse.json() as { account_id: string; name: string; picture?: string };

  const connectionId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO connections (id, user_id, provider, access_token, refresh_token, token_expires_at, account_id, account_name, account_avatar)
    VALUES (?, ?, 'jira', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      account_avatar = excluded.account_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    userId,
    tokenData.access_token,
    tokenData.refresh_token ?? null,
    expiresAt,
    userData?.account_id ?? primaryResource?.id ?? null,
    userData?.name ?? primaryResource?.name ?? null,
    userData?.picture ?? primaryResource?.avatarUrl ?? null
  ).run();

  return c.html(getProviderConnectedHtml('Jira'));
});

auth.delete('/jira', authMiddleware, async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'jira').run();

  return c.json({ success: true });
});

// Bitbucket OAuth routes
auth.get('/bitbucket', async (c) => {
  if (!providerEnabled(c.env, 'bitbucket')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  return c.json({ error: 'Deprecated endpoint. Use POST /auth/bitbucket/start.' }, 410);
});

auth.post('/bitbucket/start', authMiddleware, async (c) => {
  if (!providerEnabled(c.env, 'bitbucket')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  const user = c.get('user');
  await cleanupOAuthStates(c.env.DB);

  const { state, expiresAt } = await createOAuthState(c.env.DB, user.id, 'bitbucket');
  const redirectUri = `${c.env.APP_URL}/auth/bitbucket/callback`;

  const url = new URL('https://bitbucket.org/site/oauth2/authorize');
  url.searchParams.set('client_id', c.env.BITBUCKET_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  return c.json({
    url: url.toString(),
    expiresAt,
  });
});

auth.get('/bitbucket/callback', async (c) => {
  if (!providerEnabled(c.env, 'bitbucket')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const userId = await consumeOAuthState(c.env.DB, state, 'bitbucket');
  if (!userId) {
    return c.json({ error: 'Invalid or expired OAuth state' }, 400);
  }

  const credentials = btoa(`${c.env.BITBUCKET_CLIENT_ID}:${c.env.BITBUCKET_CLIENT_SECRET}`);
  const redirectUri = `${c.env.APP_URL}/auth/bitbucket/callback`;

  const tokenResponse = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenResponse.json() as OAuthTokenResponse;

  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange code for token', details: tokenData.error }, 400);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Get user info
  const userResponse = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/json',
    },
  });

  const userData = await userResponse.json() as {
    uuid: string;
    display_name: string;
    account_id?: string;
    links?: { avatar?: { href: string } };
  };

  const connectionId = generateId();
  await c.env.DB.prepare(`
    INSERT INTO connections (id, user_id, provider, access_token, refresh_token, token_expires_at, account_id, account_name, account_avatar)
    VALUES (?, ?, 'bitbucket', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, provider) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      account_id = excluded.account_id,
      account_name = excluded.account_name,
      account_avatar = excluded.account_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    connectionId,
    userId,
    tokenData.access_token,
    tokenData.refresh_token ?? null,
    expiresAt,
    userData.uuid ?? userData.account_id ?? null,
    userData.display_name ?? null,
    userData.links?.avatar?.href ?? null
  ).run();

  return c.html(getProviderConnectedHtml('Bitbucket'));
});

auth.delete('/bitbucket', authMiddleware, async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'bitbucket').run();

  return c.json({ success: true });
});

export default auth;
