import { Hono, type Context } from 'hono';
import type { Env, Variables, User, Connection } from '../types';
import { fetchJiraAttachmentStream } from '../services/jira-attachment';

const attachments = new Hono<{ Bindings: Env; Variables: Variables }>();

/** Attachment proxy routes authenticate the device via either the
 *  `Authorization: Bearer <token>` header OR a `?t=<token>` query param —
 *  browsers can't set custom headers on `<img src>` tags, so image
 *  consumers fall back to the query param. The token is the same
 *  device token used elsewhere; the query-param surface is restricted
 *  to `/attachments/*` GETs so it doesn't leak to mutation endpoints. */
async function resolveUser(
  c: Context<{ Bindings: Env; Variables: Variables }>,
): Promise<User | null> {
  const header = c.req.header('Authorization');
  let token: string | null = null;
  if (header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) token = c.req.query('t') ?? null;
  if (!token) return null;
  return c.env.DB.prepare('SELECT * FROM users WHERE device_token = ?')
    .bind(token)
    .first<User>();
}

attachments.get('/jira/:id', async (c) => {
  const user = await resolveUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);

  const id = c.req.param('id');
  if (!/^\d+$/.test(id)) return c.json({ error: 'invalid attachment id' }, 400);

  const connection = await c.env.DB.prepare(
    'SELECT * FROM connections WHERE user_id = ? AND provider = ?',
  )
    .bind(user.id, 'jira')
    .first<Connection>();
  if (!connection) return c.json({ error: 'no jira connection' }, 404);

  try {
    const { body, contentType, contentLength } = await fetchJiraAttachmentStream(
      connection,
      c.env,
      c.env.DB,
      id,
    );
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      // The image rarely changes. One-hour private cache keeps the
      // webview from re-fetching on every detail-pane selection without
      // pinning a stale blob across days.
      'Cache-Control': 'private, max-age=3600',
    };
    if (contentLength) headers['Content-Length'] = contentLength;
    return new Response(body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('jira attachment proxy failed:', message);
    return c.json({ error: 'attachment fetch failed', detail: message }, 502);
  }
});

export default attachments;
