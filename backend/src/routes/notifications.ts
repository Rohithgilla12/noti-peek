import { Hono } from 'hono';
import type { Env, Variables, Connection, NotificationResponse, Provider, RateLimitInfo } from '../types';
import { RateLimitError } from '../types';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import { fetchGitHubNotifications, markGitHubNotificationAsRead, markAllGitHubNotificationsAsRead } from '../services/github';
import { fetchLinearNotifications, markLinearNotificationAsRead, markAllLinearNotificationsAsRead } from '../services/linear';
import { fetchJiraNotifications, markJiraNotificationAsRead, markAllJiraNotificationsAsRead } from '../services/jira';
import { fetchBitbucketNotifications, markBitbucketNotificationAsRead, markAllBitbucketNotificationsAsRead } from '../services/bitbucket';
import { bundleNotifications, BUNDLING_VERSION } from '../services/bundling';

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

notifications.use('*', authMiddleware);
notifications.use('*', rateLimitMiddleware);

async function getConnection(db: D1Database, userId: string, provider: Provider): Promise<Connection | null> {
  return db.prepare(
    'SELECT * FROM connections WHERE user_id = ? AND provider = ?'
  ).bind(userId, provider).first<Connection>();
}

function experimentalProvidersEnabled(env: Env): boolean {
  return env.ENABLE_EXPERIMENTAL_PROVIDERS === 'true';
}

notifications.get('/', async (c) => {
  const user = c.get('user');
  const enableExperimental = experimentalProvidersEnabled(c.env);
  const allNotifications: NotificationResponse[] = [];
  const errors: Array<{ provider: string; error: string; resetAt?: number }> = [];
  let githubRateLimit: RateLimitInfo | undefined;

  const [githubConn, linearConn, jiraConn, bitbucketConn] = await Promise.all([
    getConnection(c.env.DB, user.id, 'github'),
    getConnection(c.env.DB, user.id, 'linear'),
    enableExperimental ? getConnection(c.env.DB, user.id, 'jira') : Promise.resolve(null),
    enableExperimental ? getConnection(c.env.DB, user.id, 'bitbucket') : Promise.resolve(null),
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

  if (jiraConn) {
    fetchPromises.push(
      fetchJiraNotifications(jiraConn, c.env, c.env.DB)
        .then((result) => { allNotifications.push(...result.notifications); })
        .catch((err) => { errors.push({ provider: 'jira', error: err.message }); })
    );
  }

  if (bitbucketConn) {
    fetchPromises.push(
      fetchBitbucketNotifications(bitbucketConn, c.env, c.env.DB)
        .then((result) => { allNotifications.push(...result.notifications); })
        .catch((err) => { errors.push({ provider: 'bitbucket', error: err.message }); })
    );
  }

  await Promise.all(fetchPromises);

  allNotifications.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Bundling is on by default. Client may opt out with ?bundle=false (useful
  // for debugging / A-B comparison). Heuristic is pure and cheap — runs on the
  // already-aggregated in-memory list, never persisted.
  const bundleParam = c.req.query('bundle');
  const bundlingEnabled = bundleParam !== 'false' && bundleParam !== '0';

  const rows = bundlingEnabled ? bundleNotifications(allNotifications) : undefined;

  return c.json({
    // Flat list retained for back-compat with older app builds. New app builds
    // should prefer `rows` (NotificationRow[]) when present.
    notifications: allNotifications,
    rows,
    bundling_version: bundlingEnabled ? BUNDLING_VERSION : undefined,
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

notifications.get('/jira', async (c) => {
  if (!experimentalProvidersEnabled(c.env)) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }

  const user = c.get('user');
  const connection = await getConnection(c.env.DB, user.id, 'jira');

  if (!connection) {
    return c.json({ error: 'Jira not connected' }, 400);
  }

  try {
    const result = await fetchJiraNotifications(connection, c.env, c.env.DB);
    return c.json({ notifications: result.notifications });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

notifications.get('/bitbucket', async (c) => {
  if (!experimentalProvidersEnabled(c.env)) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }

  const user = c.get('user');
  const connection = await getConnection(c.env.DB, user.id, 'bitbucket');

  if (!connection) {
    return c.json({ error: 'Bitbucket not connected' }, 400);
  }

  try {
    const result = await fetchBitbucketNotifications(connection, c.env, c.env.DB);
    return c.json({ notifications: result.notifications });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

notifications.post('/:id/read', async (c) => {
  const user = c.get('user');
  const enableExperimental = experimentalProvidersEnabled(c.env);
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
  } else if (source === 'jira') {
    if (!enableExperimental) {
      return c.json({ error: 'Provider not available in this environment' }, 404);
    }
    const connection = await getConnection(c.env.DB, user.id, 'jira');
    if (!connection) {
      return c.json({ error: 'Jira not connected' }, 400);
    }
    await markJiraNotificationAsRead(connection, notificationId, c.env, c.env.DB);
  } else if (source === 'bitbucket') {
    if (!enableExperimental) {
      return c.json({ error: 'Provider not available in this environment' }, 404);
    }
    const connection = await getConnection(c.env.DB, user.id, 'bitbucket');
    if (!connection) {
      return c.json({ error: 'Bitbucket not connected' }, 400);
    }
    await markBitbucketNotificationAsRead(connection, notificationId);
  } else {
    return c.json({ error: 'Unknown notification source' }, 400);
  }

  return c.json({ success: true });
});

notifications.post('/read-all', async (c) => {
  const user = c.get('user');
  const enableExperimental = experimentalProvidersEnabled(c.env);
  const body = await c.req.json<{ source?: Provider }>().catch(() => ({ source: undefined }));
  const errors: Array<{ provider: string; error: string }> = [];

  if (!enableExperimental && (body.source === 'jira' || body.source === 'bitbucket')) {
    return c.json({ error: 'Provider not available in this environment' }, 404);
  }

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

  if (enableExperimental && (!body.source || body.source === 'jira')) {
    const connection = await getConnection(c.env.DB, user.id, 'jira');
    if (connection) {
      markPromises.push(
        markAllJiraNotificationsAsRead(connection, c.env, c.env.DB)
          .catch((err) => { errors.push({ provider: 'jira', error: err.message }); })
      );
    }
  }

  if (enableExperimental && (!body.source || body.source === 'bitbucket')) {
    const connection = await getConnection(c.env.DB, user.id, 'bitbucket');
    if (connection) {
      markPromises.push(
        markAllBitbucketNotificationsAsRead(connection)
          .catch((err) => { errors.push({ provider: 'bitbucket', error: err.message }); })
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
