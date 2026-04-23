import { Hono } from 'hono';
import type { Env, Variables, WorkLinkPair } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  upsertSuggestionDecision,
  clearDismissedSuggestions,
  prepareUpsertWorkLink,
  prepareUpsertSuggestionDecision,
} from '../services/work-links-repo';

const links = new Hono<{ Bindings: Env; Variables: Variables }>();

links.use('*', authMiddleware);

const VALID_PAIRS: WorkLinkPair[] = ['linear-github', 'jira-bitbucket'];

interface LinkPayload {
  pair?: string;
  primary_key?: string;
  linked_ref?: string;
}

function parsePayload(body: unknown): { pair: WorkLinkPair; primary_key: string; linked_ref: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as LinkPayload;
  if (!b.pair || !VALID_PAIRS.includes(b.pair as WorkLinkPair)) return null;
  if (!b.primary_key || typeof b.primary_key !== 'string') return null;
  if (!b.linked_ref || typeof b.linked_ref !== 'string') return null;
  return {
    pair: b.pair as WorkLinkPair,
    primary_key: b.primary_key,
    linked_ref: b.linked_ref,
  };
}

links.post('/confirm', async (c) => {
  const user = c.get('user');
  const parsed = parsePayload(await c.req.json().catch(() => null));
  if (!parsed) return c.json({ error: 'invalid payload' }, 400);

  const nowIso = new Date().toISOString();
  await c.env.DB.batch([
    prepareUpsertWorkLink(c.env.DB, {
      user_id: user.id,
      pair: parsed.pair,
      primary_key: parsed.primary_key,
      linked_ref: parsed.linked_ref,
      signal: 'confirmed-fuzzy',
      strict_source: null,
      confirmed_at: nowIso,
      last_seen_at: nowIso,
    }),
    prepareUpsertSuggestionDecision(c.env.DB, {
      user_id: user.id,
      pair: parsed.pair,
      primary_key: parsed.primary_key,
      linked_ref: parsed.linked_ref,
      decision: 'confirmed',
      decided_at: nowIso,
    }),
  ]);
  return c.json({ success: true });
});

links.post('/dismiss', async (c) => {
  const user = c.get('user');
  const parsed = parsePayload(await c.req.json().catch(() => null));
  if (!parsed) return c.json({ error: 'invalid payload' }, 400);

  await upsertSuggestionDecision(c.env.DB, {
    user_id: user.id,
    pair: parsed.pair,
    primary_key: parsed.primary_key,
    linked_ref: parsed.linked_ref,
    decision: 'dismissed',
    decided_at: new Date().toISOString(),
  });
  return c.json({ success: true });
});

links.post('/clear-dismissed', async (c) => {
  const user = c.get('user');
  await clearDismissedSuggestions(c.env.DB, user.id);
  return c.json({ success: true });
});

export default links;
