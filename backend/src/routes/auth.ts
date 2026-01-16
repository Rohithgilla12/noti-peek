import { Hono } from 'hono';
import type { Env, Variables, User } from '../types';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function generateId(): string {
  return crypto.randomUUID();
}

function generateDeviceToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token parameter' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE device_token = ?'
  ).bind(token).first<User>();

  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri = `${c.env.APP_URL}/auth/github/callback`;
  const state = `${user.id}:${generateId()}`;

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'notifications read:user');
  url.searchParams.set('state', state);

  return c.redirect(url.toString());
});

auth.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const [userId] = state.split(':');

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

  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

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

  return c.html(`
    <html>
      <body>
        <h1>GitHub Connected!</h1>
        <p>You can close this window and return to noti-peek.</p>
        <script>window.close();</script>
      </body>
    </html>
  `);
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
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token parameter' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE device_token = ?'
  ).bind(token).first<User>();

  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const clientId = c.env.LINEAR_CLIENT_ID;
  const redirectUri = `${c.env.APP_URL}/auth/linear/callback`;
  const state = `${user.id}:${generateId()}`;

  const url = new URL('https://linear.app/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return c.redirect(url.toString());
});

auth.get('/linear/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const [userId] = state.split(':');
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

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

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

  return c.html(`
    <html>
      <body>
        <h1>Linear Connected!</h1>
        <p>You can close this window and return to noti-peek.</p>
        <script>window.close();</script>
      </body>
    </html>
  `);
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
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token parameter' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE device_token = ?'
  ).bind(token).first<User>();

  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const clientId = c.env.JIRA_CLIENT_ID;
  const redirectUri = `${c.env.APP_URL}/auth/jira/callback`;
  const state = `${user.id}:${generateId()}`;

  const url = new URL('https://auth.atlassian.com/authorize');
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', 'read:jira-work read:jira-user offline_access');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');

  return c.redirect(url.toString());
});

auth.get('/jira/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const [userId] = state.split(':');
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

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

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

  return c.html(`
    <html>
      <body>
        <h1>Jira Connected!</h1>
        <p>You can close this window and return to noti-peek.</p>
        <script>window.close();</script>
      </body>
    </html>
  `);
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
  const token = c.req.query('token');
  if (!token) {
    return c.json({ error: 'Missing token parameter' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE device_token = ?'
  ).bind(token).first<User>();

  if (!user) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const clientId = c.env.BITBUCKET_CLIENT_ID;
  const redirectUri = `${c.env.APP_URL}/auth/bitbucket/callback`;
  const state = `${user.id}:${generateId()}`;

  const url = new URL('https://bitbucket.org/site/oauth2/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');

  return c.redirect(url.toString());
});

auth.get('/bitbucket/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const [userId] = state.split(':');

  const credentials = btoa(`${c.env.BITBUCKET_CLIENT_ID}:${c.env.BITBUCKET_CLIENT_SECRET}`);

  const tokenResponse = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };

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

  return c.html(`
    <html>
      <body>
        <h1>Bitbucket Connected!</h1>
        <p>You can close this window and return to noti-peek.</p>
        <script>window.close();</script>
      </body>
    </html>
  `);
});

auth.delete('/bitbucket', authMiddleware, async (c) => {
  const user = c.get('user');

  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'bitbucket').run();

  return c.json({ success: true });
});

export default auth;
