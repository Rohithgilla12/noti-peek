import type {
  WorkLink,
  SuggestionDecision,
  WorkLinkPair,
} from '../types';

export function prepareUpsertWorkLink(db: D1Database, link: WorkLink): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO work_links (user_id, pair, primary_key, linked_ref, signal, strict_source, confirmed_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, pair, primary_key, linked_ref)
     DO UPDATE SET signal = excluded.signal,
                   strict_source = excluded.strict_source,
                   last_seen_at = excluded.last_seen_at`
  ).bind(
    link.user_id, link.pair, link.primary_key, link.linked_ref,
    link.signal, link.strict_source, link.confirmed_at, link.last_seen_at,
  );
}

export function prepareUpsertSuggestionDecision(db: D1Database, decision: SuggestionDecision): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO suggestion_decisions (user_id, pair, primary_key, linked_ref, decision, decided_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, pair, primary_key, linked_ref)
     DO UPDATE SET decision = excluded.decision,
                   decided_at = excluded.decided_at`
  ).bind(
    decision.user_id, decision.pair, decision.primary_key, decision.linked_ref,
    decision.decision, decision.decided_at,
  );
}

export interface UserLinkState {
  workLinks: WorkLink[];
  decisions: SuggestionDecision[];
}

export async function loadUserLinkState(
  db: D1Database,
  userId: string,
): Promise<UserLinkState> {
  const [workLinksResult, decisionsResult] = await Promise.all([
    db.prepare(
      'SELECT user_id, pair, primary_key, linked_ref, signal, strict_source, confirmed_at, last_seen_at FROM work_links WHERE user_id = ?'
    ).bind(userId).all<WorkLink>(),
    db.prepare(
      'SELECT user_id, pair, primary_key, linked_ref, decision, decided_at FROM suggestion_decisions WHERE user_id = ?'
    ).bind(userId).all<SuggestionDecision>(),
  ]);
  return {
    workLinks: workLinksResult.results ?? [],
    decisions: decisionsResult.results ?? [],
  };
}

/**
 * Insert-or-refresh a work-link. On conflict, refreshes `signal`,
 * `strict_source`, and `last_seen_at` but **intentionally preserves
 * `confirmed_at`** — that timestamp captures first confirmation and must
 * remain stable across re-encounters.
 */
export async function upsertWorkLink(db: D1Database, link: WorkLink): Promise<void> {
  await db.prepare(
    `INSERT INTO work_links (user_id, pair, primary_key, linked_ref, signal, strict_source, confirmed_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, pair, primary_key, linked_ref)
     DO UPDATE SET signal = excluded.signal,
                   strict_source = excluded.strict_source,
                   last_seen_at = excluded.last_seen_at`
  ).bind(
    link.user_id, link.pair, link.primary_key, link.linked_ref,
    link.signal, link.strict_source, link.confirmed_at, link.last_seen_at,
  ).run();
}

export async function touchWorkLinkLastSeen(
  db: D1Database,
  userId: string,
  pair: WorkLinkPair,
  primaryKey: string,
  linkedRef: string,
  lastSeenAt: string,
): Promise<void> {
  await db.prepare(
    'UPDATE work_links SET last_seen_at = ? WHERE user_id = ? AND pair = ? AND primary_key = ? AND linked_ref = ?'
  ).bind(lastSeenAt, userId, pair, primaryKey, linkedRef).run();
}

export async function upsertSuggestionDecision(
  db: D1Database,
  decision: SuggestionDecision,
): Promise<void> {
  await db.prepare(
    `INSERT INTO suggestion_decisions (user_id, pair, primary_key, linked_ref, decision, decided_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, pair, primary_key, linked_ref)
     DO UPDATE SET decision = excluded.decision,
                   decided_at = excluded.decided_at`
  ).bind(
    decision.user_id, decision.pair, decision.primary_key, decision.linked_ref,
    decision.decision, decision.decided_at,
  ).run();
}

export async function clearDismissedSuggestions(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db.prepare(
    'DELETE FROM suggestion_decisions WHERE user_id = ? AND decision = ?'
  ).bind(userId, 'dismissed').run();
}
