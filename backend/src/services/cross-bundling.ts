/**
 * Cross-provider work-unit bundling.
 *
 * Design: docs/superpowers/specs/2026-04-22-cross-provider-bundling-design.md
 *
 * Pure functional core — no I/O. Callers load decisions + enriched notifications
 * and pass them in; this module decides what's bundled and what's suggested.
 */

import type {
  NotificationResponse,
  NotificationAuthor,
  Provider,
  WorkLinkPair,
  StrictSource,
  LinkHint,
  SuggestionDecision,
  WorkLink,
  SuggestedLinkRationale,
  CrossBundleResponse,
  CrossBundleLinkedSide,
} from '../types';

// Title-prefix patterns, evaluated in order. The first capture group is the key.
const TITLE_PREFIX_PATTERNS: RegExp[] = [
  /^\s*\[([A-Z]{2,10}-\d+)\]/i,
  /^\s*\(([A-Z]{2,10}-\d+)\)/i,
  /^\s*([A-Z]{2,10}-\d+)[:\s]/i,
];

// Fallback: any key-shaped token elsewhere in the title, bounded by word boundaries.
const TITLE_EMBEDDED = /\b([A-Z]{2,10}-\d+)\b/i;

// Body trailer verbs — conventional "Closes LIN-142" style references.
const BODY_TRAILER =
  /\b(?:Closes|Closed|Fixes|Fixed|Resolves|Resolved|Relates to|Part of|See)\s+([A-Z]{2,10}-\d+)\b/gi;

export function extractTitleKey(title: string): string | null {
  if (!title) return null;
  for (const pattern of TITLE_PREFIX_PATTERNS) {
    const m = title.match(pattern);
    if (m) return m[1].toUpperCase();
  }
  const embedded = title.match(TITLE_EMBEDDED);
  if (embedded) return embedded[1].toUpperCase();
  return null;
}

export function extractBodyTrailerKeys(body: string | undefined): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(BODY_TRAILER)) {
    const key = m[1].toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Types that never participate in cross-bundling (mirrors v1 NEVER_BUNDLE_TYPES). */
const NEVER_BUNDLE_TYPES = new Set(['release', 'commit', 'check_suite']);

/** Which providers are "ticket" vs "PR" side in each pairing. */
const PAIR_ROLES: Record<WorkLinkPair, { ticket: Provider; pr: Provider }> = {
  'linear-github': { ticket: 'linear', pr: 'github' },
  'jira-bitbucket': { ticket: 'jira', pr: 'bitbucket' },
};

export interface StrictLinkCandidate {
  pair: WorkLinkPair;
  primary_key: string;
  linked_ref: string;
  strict_source: StrictSource;
  primaryId: string;
  linkedId: string;
}

function extractLinearKey(url: string): string | null {
  // Require a path separator, query, fragment, or end-of-string after the key so
  // we don't false-match partial tokens inside a longer slug.
  const m = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]{2,10}-\d+)(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function extractJiraKey(url: string): string | null {
  // Anchor to the Atlassian-hosted domain so a GitHub/wiki URL containing
  // "/browse/XYZ-1" elsewhere can't masquerade as a Jira issue ref.
  const m = url.match(/atlassian\.net\/browse\/([A-Z]{2,10}-\d+)(?:[/?#]|$)/i);
  return m ? m[1].toUpperCase() : null;
}

function extractGithubRef(url: string): string | null {
  const m = url.match(/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/i);
  return m ? `${m[1]}/${m[2]}#${m[4]}` : null;
}

function extractBitbucketRef(url: string): string | null {
  const m = url.match(/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/i);
  return m ? `${m[1]}/${m[2]}#${m[3]}` : null;
}

function bitbucketRefFromHint(h: Extract<LinkHint, { kind: 'bitbucket-pr' }>): string {
  return `${h.workspace}/${h.repo}#${h.id}`;
}

export function collectStrictLinks(
  notifications: NotificationResponse[],
  pair: WorkLinkPair,
): StrictLinkCandidate[] {
  const { ticket: ticketSource, pr: prSource } = PAIR_ROLES[pair];

  const ticketByKey = new Map<string, NotificationResponse>();
  const prByRef = new Map<string, NotificationResponse>();

  for (const n of notifications) {
    if (NEVER_BUNDLE_TYPES.has(n.type)) continue;
    if (n.source === ticketSource) {
      const key = pair === 'linear-github' ? extractLinearKey(n.url) : extractJiraKey(n.url);
      if (key) ticketByKey.set(key, n);
    } else if (n.source === prSource) {
      const ref = pair === 'linear-github' ? extractGithubRef(n.url) : extractBitbucketRef(n.url);
      if (ref) prByRef.set(ref, n);
    }
  }

  const seen = new Set<string>();
  const out: StrictLinkCandidate[] = [];

  function emit(key: string, ref: string, source: StrictSource) {
    const dedup = `${key}→${ref}`;
    if (seen.has(dedup)) return;
    const ticket = ticketByKey.get(key);
    const pr = prByRef.get(ref);
    if (!ticket || !pr) return;
    seen.add(dedup);
    out.push({
      pair, primary_key: key, linked_ref: ref,
      strict_source: source,
      primaryId: ticket.id, linkedId: pr.id,
    });
  }

  for (const [ref, pr] of prByRef) {
    const key = extractTitleKey(pr.title);
    if (key) emit(key, ref, 'title-prefix');
  }

  for (const [ref, pr] of prByRef) {
    for (const key of extractBodyTrailerKeys(pr.body)) {
      emit(key, ref, 'body-trailer');
    }
  }

  for (const [key, ticket] of ticketByKey) {
    if (!ticket.linkHints) continue;
    for (const hint of ticket.linkHints) {
      if (pair === 'linear-github' && hint.kind === 'github-url') {
        const ref = extractGithubRef(hint.url);
        if (ref) emit(key, ref, 'linear-attachment');
      } else if (pair === 'jira-bitbucket' && hint.kind === 'bitbucket-pr') {
        emit(key, bitbucketRefFromHint(hint), 'jira-dev-panel');
      }
    }
  }

  return out;
}

export const FUZZY_THRESHOLD = 0.7;

const STOPWORDS = new Set([
  'a','an','and','the','of','to','for','in','on','with','is','are','be','it','this','that','pr','mr','issue','ticket',
  'fix','fixes','fixed','add','adds','added','update','updates','remove','removes','refactor','refactors',
  'wip','draft','chore','feat','test','tests','bug',
]);

function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function temporalScore(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  const diffHours = Math.abs(ta - tb) / (60 * 60 * 1000);
  if (diffHours <= 24) return 1.0;
  if (diffHours <= 48) return 0.5;
  return 0;
}

function decisionKey(pair: WorkLinkPair, primaryKey: string, linkedRef: string): string {
  return `${pair}:${primaryKey}:${linkedRef}`;
}

export interface FuzzyCandidate {
  pair: WorkLinkPair;
  primary_key: string;
  linked_ref: string;
  primary: {
    source: Provider; key: string; title: string; url: string; updatedAt: string;
  };
  linked: {
    source: Provider; ref: string; title: string; url: string; updatedAt: string;
  };
  confidence: number;
  rationale: SuggestedLinkRationale[];
}

export function scoreFuzzyCandidates(
  notifications: NotificationResponse[],
  pair: WorkLinkPair,
  workLinks: WorkLink[],
  decisions: SuggestionDecision[],
): FuzzyCandidate[] {
  const { ticket: ticketSource, pr: prSource } = PAIR_ROLES[pair];

  const tickets: Array<{ n: NotificationResponse; key: string }> = [];
  const prs: Array<{ n: NotificationResponse; ref: string }> = [];
  for (const n of notifications) {
    if (NEVER_BUNDLE_TYPES.has(n.type)) continue;
    if (n.source === ticketSource) {
      const key = pair === 'linear-github' ? extractLinearKey(n.url) : extractJiraKey(n.url);
      if (key) tickets.push({ n, key });
    } else if (n.source === prSource) {
      const ref = pair === 'linear-github' ? extractGithubRef(n.url) : extractBitbucketRef(n.url);
      if (ref) prs.push({ n, ref });
    }
  }

  const excluded = new Set<string>();
  for (const w of workLinks) {
    if (w.pair === pair) excluded.add(decisionKey(pair, w.primary_key, w.linked_ref));
  }
  for (const d of decisions) {
    if (d.pair === pair) excluded.add(decisionKey(pair, d.primary_key, d.linked_ref));
  }

  const out: FuzzyCandidate[] = [];

  for (const { n: ticket, key } of tickets) {
    for (const { n: pr, ref } of prs) {
      if (excluded.has(decisionKey(pair, key, ref))) continue;

      const rationale: SuggestedLinkRationale[] = [];
      let score = 0;

      if (normalizeName(ticket.author.name) === normalizeName(pr.author.name)) {
        score += 0.35;
        rationale.push('author-match');
      }

      const overlap = jaccard(tokenize(ticket.title), tokenize(pr.title));
      if (overlap >= 0.4) {
        score += 0.30 * overlap;
        rationale.push('title-overlap');
      }

      const t = temporalScore(ticket.updatedAt, pr.updatedAt);
      if (t > 0) {
        score += 0.15 * t;
        rationale.push('temporal-close');
      }

      if (ticket.unread && pr.unread) {
        score += 0.10;
        rationale.push('both-open');
      }

      const confirmedAffinity = workLinks.some((w) =>
        w.pair === pair && w.primary_key.split('-')[0] === key.split('-')[0]);
      if (confirmedAffinity) {
        score += 0.10;
        rationale.push('repo-affinity');
      }

      if (score >= FUZZY_THRESHOLD) {
        out.push({
          pair, primary_key: key, linked_ref: ref,
          primary: {
            source: ticket.source, key, title: ticket.title,
            url: ticket.url, updatedAt: ticket.updatedAt,
          },
          linked: {
            source: pr.source, ref, title: pr.title,
            url: pr.url, updatedAt: pr.updatedAt,
          },
          confidence: Math.min(1, score),
          rationale,
        });
      }
    }
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

export const MAX_ACTORS_SHOWN = 3;

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export interface BuildCrossBundleInput {
  pair: WorkLinkPair;
  primaryNotif: NotificationResponse;
  linkedNotifs: NotificationResponse[];
  extraTicketSide: NotificationResponse[];
  extraPrSide: NotificationResponse[];
  linkedSideMeta: CrossBundleLinkedSide[];
}

export function buildCrossBundle(input: BuildCrossBundleInput): CrossBundleResponse {
  const all = [
    input.primaryNotif,
    ...input.linkedNotifs,
    ...input.extraTicketSide,
    ...input.extraPrSide,
  ];
  const sorted = [...all].sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];

  const actorSeen = new Set<string>();
  const actors: NotificationAuthor[] = [];
  for (const n of sorted) {
    const key = n.author.name.trim().toLowerCase();
    if (actorSeen.has(key)) continue;
    actorSeen.add(key);
    actors.push({ name: n.author.name, avatar: n.author.avatar });
  }
  const extra_actor_count = Math.max(0, actors.length - MAX_ACTORS_SHOWN);
  const actorsCapped = actors.slice(0, MAX_ACTORS_SHOWN);

  const type_summary: Record<string, number> = {};
  const source_summary: Partial<Record<Provider, number>> = {};
  let unread_count = 0;
  for (const n of sorted) {
    type_summary[n.type] = (type_summary[n.type] ?? 0) + 1;
    source_summary[n.source] = (source_summary[n.source] ?? 0) + 1;
    if (n.unread) unread_count++;
  }

  const primaryKey = input.pair === 'linear-github'
    ? extractLinearKey(input.primaryNotif.url)!
    : extractJiraKey(input.primaryNotif.url)!;

  return {
    id: `xbundle:${input.pair}:${primaryKey}:${earliest.updatedAt}`,
    pair: input.pair,
    primary: {
      source: input.primaryNotif.source,
      key: primaryKey,
      title: input.primaryNotif.title,
      url: input.primaryNotif.url,
    },
    linked: input.linkedSideMeta,
    event_count: sorted.length,
    unread_count,
    actors: actorsCapped,
    extra_actor_count,
    type_summary,
    source_summary,
    latest_at: latest.updatedAt,
    earliest_at: earliest.updatedAt,
    children: sorted,
  };
}
