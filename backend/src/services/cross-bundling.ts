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
  Provider,
  WorkLinkPair,
  StrictSource,
  LinkHint,
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
  const m = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

function extractJiraKey(url: string): string | null {
  const m = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
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
