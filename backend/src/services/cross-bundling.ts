/**
 * Cross-provider work-unit bundling.
 *
 * Design: docs/superpowers/specs/2026-04-22-cross-provider-bundling-design.md
 *
 * Pure functional core — no I/O. Callers load decisions + enriched notifications
 * and pass them in; this module decides what's bundled and what's suggested.
 */

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
