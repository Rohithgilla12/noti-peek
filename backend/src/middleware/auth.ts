import { Context, MiddlewareHandler } from 'hono';
import type { Env, Variables, User } from '../types';

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: Variables }> = async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401);
  }

  const deviceToken = authHeader.slice(7);

  if (!deviceToken) {
    return c.json({ error: 'Invalid device token' }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE device_token = ?'
  ).bind(deviceToken).first<User>();

  if (!user) {
    return c.json({ error: 'Invalid device token' }, 401);
  }

  c.set('user', user);
  await next();
};
