import { Hono } from 'hono';
import type { Env, Variables, Connection, NotificationResponse, Provider, RateLimitInfo } from '../types';
import { RateLimitError } from '../types';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import { fetchGitHubNotifications, markGitHubNotificationAsRead, markAllGitHubNotificationsAsRead } from '../services/github';
import { fetchLinearNotifications, markLinearNotificationAsRead, markAllLinearNotificationsAsRead } from '../services/linear';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

notifications.use('*', authMiddleware);
notifications.use('*', rateLimitMiddleware);

async function getConnection(db: D1Database, userId: string, provider: Provider): Promise<Connection | null> {
  return db.prepare(
    'SELECT * FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(userId, provider).first<Connection>();
}

notifications.get('/', async (c) => {
  const user = c.get('user');
  const allNotifications: NotificationResponse[] = [];
  const errors: Array<{ provider: string; error: string; resetAt?: number }> = [];
  let githubRateLimit: RateLimitInfo | undefined;

  const [githubConn, linearConn] = await Promise.all([
    getConnection(c.env.DB, user.id, 'github'),
    getConnection(c.env.DB, user.id, 'linear'),
  ]);

  const fetchPromises: Promise<void>[] = [];

  if (githubConn) {
    fetchPromises.push(
      fetchGitHubNotifications(githubConn)
        .then((result) => {
          allNotifications.push(...result.notifications);
          githubRateLimit = result.rateLimitInfo;
        })
        .catch((err) => {
          if (err instanceof RateLimitError) {
            errors.push({
              provider: 'github',
              error: err.message,
              resetAt: err.resetAt,
            });
          } else {
            errors.push({ provider: 'github', error: err.message });
          }
        })
    );
  }

  if (linearConn) {
    fetchPromises.push(
      fetchLinearNotifications(linearConn, c.env, c.env.DB)
        .then((result) => { allNotifications.push(...result.notifications); })
        .catch((err) => { errors.push({ provider: 'linear', error: err.message }); })
    );
  }

  await Promise.all(fetchPromises);

  allNotifications.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return c.json({
    notifications: allNotifications,
    errors: errors.length > 0 ? errors : undefined,
    rateLimitInfo: githubRateLimit,
  });
});

notifications.get('/github', async (c) => {
  const user = c.get('user');
  const connection = await getConnection(c.env.DB, user.id, 'github');

  if (!connection) {
    return c.json({ error: 'GitHub not connected' }, 400);
  }

  try {
    const result = await fetchGitHubNotifications(connection);
    return c.json({
      notifications: result.notifications,
      rateLimitInfo: result.rateLimitInfo,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return c.json({
        error: err.message,
        resetAt: err.resetAt,
        remaining: err.remaining,
      }, 429);
    }
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

notifications.get('/linear', async (c) => {
  const user = c.get('user');
  const connection = await getConnection(c.env.DB, user.id, 'linear');

  if (!connection) {
    return c.json({ error: 'Linear not connected' }, 400);
  }

  try {
    const result = await fetchLinearNotifications(connection, c.env, c.env.DB);
    return c.json({ notifications: result.notifications });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

notifications.post('/:id/read', async (c) => {
  const user = c.get('user');
  const notificationId = c.req.param('id');

  const [source] = notificationId.split(':');

  if (source === 'github') {
    const connection = await getConnection(c.env.DB, user.id, 'github');
    if (!connection) {
      return c.json({ error: 'GitHub not connected' }, 400);
    }
    await markGitHubNotificationAsRead(connection, notificationId);
  } else if (source === 'linear') {
    const connection = await getConnection(c.env.DB, user.id, 'linear');
    if (!connection) {
      return c.json({ error: 'Linear not connected' }, 400);
    }
    await markLinearNotificationAsRead(connection, notificationId);
  } else {
    return c.json({ error: 'Unknown notification source' }, 400);
  }

  return c.json({ success: true });
});

notifications.post('/read-all', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ source?: Provider }>().catch(() => ({ source: undefined }));
  const errors: Array<{ provider: string; error: string }> = [];

  const markPromises: Promise<void>[] = [];

  if (!body.source || body.source === 'github') {
    const connection = await getConnection(c.env.DB, user.id, 'github');
    if (connection) {
      markPromises.push(
        markAllGitHubNotificationsAsRead(connection)
          .catch((err) => { errors.push({ provider: 'github', error: err.message }); })
      );
    }
  }

  if (!body.source || body.source === 'linear') {
    const connection = await getConnection(c.env.DB, user.id, 'linear');
    if (connection) {
      markPromises.push(
        markAllLinearNotificationsAsRead(connection)
          .catch((err) => { errors.push({ provider: 'linear', error: err.message }); })
      );
    }
  }

  await Promise.all(markPromises);

  return c.json({
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  });
});

export default notifications;
