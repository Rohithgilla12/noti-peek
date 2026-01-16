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

auth.get('/github', authMiddleware, async (c) => {
  const user = c.get('user');
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

auth.get('/linear', authMiddleware, async (c) => {
  const user = c.get('user');
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

  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    return c.json({ error: 'Failed to exchange code for token', details: tokenData.error }, 400);
  }

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
    INSERT INTO connections (id, user_id, provider, access_token, account_id, account_name, account_avatar)
    VALUES (?, ?, 'linear', ?, ?, ?, ?)
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

export default auth;
