import { Hono } from 'hono';
import type { Env, Variables, Connection } from '../types';
import { authMiddleware } from '../middleware/auth';

const connections = new Hono<{ Bindings: Env; Variables: Variables }>();

connections.use('*', authMiddleware);

connections.get('/', async (c) => {
  const user = c.get('user');

  const result = await c.env.DB.prepare(
    'SELECT provider, account_id, account_name, account_avatar, created_at FROM connections WHERE user_id = ?'
  ).bind(user.id).all<Connection>();

  const connectedAccounts = result.results.map((conn) => ({
    provider: conn.provider,
    accountId: conn.account_id,
    accountName: conn.account_name,
    accountAvatar: conn.account_avatar,
    connectedAt: conn.created_at,
  }));

  return c.json({ connections: connectedAccounts });
});

export default connections;
