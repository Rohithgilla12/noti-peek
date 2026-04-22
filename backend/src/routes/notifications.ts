import { Hono } from 'hono';
import type { Env, Variables, Connection, NotificationResponse, Provider, RateLimitInfo, DetailResponse, WorkLinkPair, CrossBundleResponse, SuggestedLink, WorkLink } from '../types';
import { RateLimitError, InsufficientScopeError, TokenExpiredError } from '../types';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimiter';
import { fetchGitHubNotifications, markGitHubNotificationAsRead, markAllGitHubNotificationsAsRead } from '../services/github';
import { fetchLinearNotifications, markLinearNotificationAsRead, markAllLinearNotificationsAsRead } from '../services/linear';
import { fetchJiraNotifications, markJiraNotificationAsRead, markAllJiraNotificationsAsRead } from '../services/jira';
import { fetchBitbucketNotifications, markBitbucketNotificationAsRead, markAllBitbucketNotificationsAsRead } from '../services/bitbucket';
import { bundleNotifications, BUNDLING_VERSION } from '../services/bundling';
import type { BundleResponse } from '../services/bundling';
import { buildCrossBundles } from '../services/cross-bundling';
import { loadUserLinkState, upsertWorkLink, touchWorkLinkLastSeen } from '../services/work-links-repo';
import { parseGitHubIssueOrPRUrl } from '../services/github-urls';
import {
  fetchIssueDetails, fetchPRDetails,
  postIssueComment, setIssueState,
  submitPRReview, mergePR,
} from '../services/github-detail';
import {
  fetchJiraIssueDetails, parseJiraIssueUrl,
  postJiraComment, transitionJiraIssue, assignJiraSelf,
} from '../services/jira-detail';

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

function crossProviderBundlingEnabled(env: Env): boolean {
  // Default on. Engineer-side kill switch via wrangler env var.
  return env.CROSS_PROVIDER_BUNDLING !== 'false';
}

type AnyRow =
  | { kind: 'single'; notification: { updatedAt: string } }
  | { kind: 'bundle'; bundle: { latest_at: string } }
  | { kind: 'cross_bundle'; bundle: { latest_at: string } };

function rowLatestMs(row: AnyRow): number {
  if (row.kind === 'single') return Date.parse(row.notification.updatedAt);
  return Date.parse(row.bundle.latest_at);
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
  // for debugging / A-B comparison). ?bundle=false disables ALL bundling (v1 +
  // cross). CROSS_PROVIDER_BUNDLING=false kills only the cross branch.
  const bundleParam = c.req.query('bundle');
  const bundlingEnabled = bundleParam !== 'false' && bundleParam !== '0';
  const crossEnabled = crossProviderBundlingEnabled(c.env);
  const nowMs = Date.now();

  let rows: Array<
    | { kind: 'single'; notification: NotificationResponse }
    | { kind: 'bundle'; bundle: BundleResponse }
    | { kind: 'cross_bundle'; bundle: CrossBundleResponse }
  > | undefined;
  let suggested_links: SuggestedLink[] | undefined;
  let bundlingVersionOut: number | undefined;

  if (bundlingEnabled) {
    let remaining = allNotifications;
    const crossBundleRows: Array<{ kind: 'cross_bundle'; bundle: CrossBundleResponse }> = [];
    const allSuggestions: SuggestedLink[] = [];
    const strictToUpsert: WorkLink[] = [];
    const seenStrictLinks: Array<Pick<WorkLink, 'pair' | 'primary_key' | 'linked_ref'>> = [];

    if (crossEnabled) {
      const { workLinks, decisions } = await loadUserLinkState(c.env.DB, user.id);
      const pairs: WorkLinkPair[] = ['linear-github', 'jira-bitbucket'];

      for (const pair of pairs) {
        const result = buildCrossBundles({
          notifications: remaining, pair,
          workLinks, decisions, userId: user.id, now: nowMs,
        });
        for (const b of result.crossBundles) {
          crossBundleRows.push({ kind: 'cross_bundle', bundle: b });
        }
        strictToUpsert.push(...result.strictLinksInferred);
        for (const b of result.crossBundles) {
          for (const linked of b.linked) {
            seenStrictLinks.push({ pair, primary_key: b.primary.key, linked_ref: linked.ref });
          }
        }
        allSuggestions.push(...result.fuzzyCandidates);
        remaining = remaining.filter((n) => !result.consumedNotificationIds.has(n.id));
      }
    }

    const v1Rows = bundleNotifications(remaining);
    rows = [...crossBundleRows, ...v1Rows].sort((a, b) => rowLatestMs(b as AnyRow) - rowLatestMs(a as AnyRow));
    bundlingVersionOut = 2;
    if (allSuggestions.length > 0) suggested_links = allSuggestions;

    // Fire-and-forget persistence — failure logs but does not fail the request.
    c.executionCtx.waitUntil((async () => {
      try {
        for (const link of strictToUpsert) await upsertWorkLink(c.env.DB, link);
        const nowIso = new Date(nowMs).toISOString();
        for (const s of seenStrictLinks) {
          await touchWorkLinkLastSeen(c.env.DB, user.id, s.pair, s.primary_key, s.linked_ref, nowIso);
        }
      } catch (err) {
        console.error('[cross-bundling] link upsert failed', err);
      }
    })());
  }

  return c.json({
    // Flat list retained for back-compat with older app builds. New app builds
    // should prefer `rows` (NotificationRow[]) when present.
    notifications: allNotifications,
    rows,
    bundling_version: bundlingVersionOut,
    suggested_links,
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

notifications.get('/:id/details', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const url = c.req.query('url');

  if (!url) return c.json({ error: 'url query parameter required' }, 400);

  const [source] = id.split(':');

  try {
    if (source === 'github') {
      const parsed = parseGitHubIssueOrPRUrl(url);
      if (!parsed) return c.json({ error: 'not a GitHub issue or PR URL' }, 400);

      const connection = await getConnection(c.env.DB, user.id, 'github');
      if (!connection) return c.json({ error: 'GitHub not connected' }, 400);

      const details = parsed.kind === 'pr'
        ? await fetchPRDetails(connection, parsed.owner, parsed.repo, parsed.number)
        : await fetchIssueDetails(connection, parsed.owner, parsed.repo, parsed.number);

      const response: DetailResponse = {
        id, source: 'github', details, fetchedAt: new Date().toISOString(),
      };
      return c.json(response);
    }

    if (source === 'jira') {
      const parsed = parseJiraIssueUrl(url);
      if (!parsed) return c.json({ error: 'not a Jira issue URL' }, 400);

      const connection = await getConnection(c.env.DB, user.id, 'jira');
      if (!connection) return c.json({ error: 'Jira not connected' }, 400);

      const details = await fetchJiraIssueDetails(connection, c.env, c.env.DB, parsed.key);

      const response: DetailResponse = {
        id, source: 'jira', details, fetchedAt: new Date().toISOString(),
      };
      return c.json(response);
    }

    return c.json({ error: 'unknown notification source' }, 400);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      // Surface as a reconnect-required error so the frontend drops into the
      // same reconnect CTA flow as insufficient_scope. The remediation is
      // identical: user reconnects the provider.
      const provider = source === 'jira' ? 'jira' : 'github';
      return c.json({
        error: 'token_expired',
        reconnectUrl: `/auth/${provider}/start`,
        reconnectProvider: provider,
      }, 401);
    }
    if (err instanceof InsufficientScopeError) {
      return c.json({
        error: 'insufficient_scope',
        reconnectUrl: `/auth/${err.reconnectProvider}/start`,
        reconnectProvider: err.reconnectProvider,
      }, 403);
    }
    return c.json({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
  }
});

notifications.post('/:id/actions/:action', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const action = c.req.param('action');
  const body = await c.req.json<{ url: string; body?: string; method?: 'merge' | 'squash' | 'rebase'; transitionId?: string; reason?: 'completed' | 'not_planned' }>()
    .catch(() => null);
  if (!body || typeof body.url !== 'string') return c.json({ error: 'url required in body' }, 400);

  const [source] = id.split(':');

  try {
    if (source === 'github') {
      const parsed = parseGitHubIssueOrPRUrl(body.url);
      if (!parsed) return c.json({ error: 'not a GitHub issue or PR URL' }, 400);

      const connection = await getConnection(c.env.DB, user.id, 'github');
      if (!connection) return c.json({ error: 'GitHub not connected' }, 400);

      switch (action) {
        case 'comment':
          if (!body.body) return c.json({ error: 'body required' }, 400);
          await postIssueComment(connection, parsed.owner, parsed.repo, parsed.number, body.body);
          break;
        case 'close':
          await setIssueState(connection, parsed.owner, parsed.repo, parsed.number, 'closed', body.reason ?? 'completed');
          break;
        case 'reopen':
          await setIssueState(connection, parsed.owner, parsed.repo, parsed.number, 'open');
          break;
        case 'approve':
          if (parsed.kind !== 'pr') return c.json({ error: 'approve only valid on PRs' }, 400);
          await submitPRReview(connection, parsed.owner, parsed.repo, parsed.number, 'APPROVE', body.body);
          break;
        case 'request_changes':
          if (parsed.kind !== 'pr') return c.json({ error: 'request_changes only valid on PRs' }, 400);
          if (!body.body) return c.json({ error: 'body required for request_changes' }, 400);
          await submitPRReview(connection, parsed.owner, parsed.repo, parsed.number, 'REQUEST_CHANGES', body.body);
          break;
        case 'merge':
          if (parsed.kind !== 'pr') return c.json({ error: 'merge only valid on PRs' }, 400);
          await mergePR(connection, parsed.owner, parsed.repo, parsed.number, body.method ?? 'squash');
          break;
        default:
          return c.json({ error: `unknown github action: ${action}` }, 400);
      }

      const details = parsed.kind === 'pr'
        ? await fetchPRDetails(connection, parsed.owner, parsed.repo, parsed.number)
        : await fetchIssueDetails(connection, parsed.owner, parsed.repo, parsed.number);

      return c.json({
        success: true,
        details: { id, source: 'github', details, fetchedAt: new Date().toISOString() },
      });
    }

    if (source === 'jira') {
      const parsed = parseJiraIssueUrl(body.url);
      if (!parsed) return c.json({ error: 'not a Jira issue URL' }, 400);

      const connection = await getConnection(c.env.DB, user.id, 'jira');
      if (!connection) return c.json({ error: 'Jira not connected' }, 400);

      switch (action) {
        case 'comment':
          if (!body.body) return c.json({ error: 'body required' }, 400);
          await postJiraComment(connection, c.env, c.env.DB, parsed.key, body.body);
          break;
        case 'transition':
          if (!body.transitionId) return c.json({ error: 'transitionId required' }, 400);
          await transitionJiraIssue(connection, c.env, c.env.DB, parsed.key, body.transitionId);
          break;
        case 'assign_self':
          await assignJiraSelf(connection, c.env, c.env.DB, parsed.key);
          break;
        default:
          return c.json({ error: `unknown jira action: ${action}` }, 400);
      }

      const details = await fetchJiraIssueDetails(connection, c.env, c.env.DB, parsed.key);
      return c.json({
        success: true,
        details: { id, source: 'jira', details, fetchedAt: new Date().toISOString() },
      });
    }

    return c.json({ error: 'unknown notification source' }, 400);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      // Surface as a reconnect-required error so the frontend drops into the
      // same reconnect CTA flow as insufficient_scope. The remediation is
      // identical: user reconnects the provider.
      const provider = source === 'jira' ? 'jira' : 'github';
      return c.json({
        error: 'token_expired',
        reconnectUrl: `/auth/${provider}/start`,
        reconnectProvider: provider,
      }, 401);
    }
    if (err instanceof InsufficientScopeError) {
      return c.json({
        success: false,
        error: 'insufficient_scope',
        reconnectUrl: `/auth/${err.reconnectProvider}/start`,
        reconnectProvider: err.reconnectProvider,
      }, 403);
    }
    return c.json({ error: err instanceof Error ? err.message : 'unknown error' }, 500);
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
