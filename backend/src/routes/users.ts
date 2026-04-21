import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

users.use('*', authMiddleware);

users.delete('/me', async (c) => {
  const user = c.get('user');

  // D1 FK enforcement has been historically inconsistent; do the cascade
  // explicitly in a single batch so either every child row goes or none do.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM oauth_states WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM notifications_cache WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM connections WHERE user_id = ?').bind(user.id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  return c.json({ success: true });
});

export default users;
