import { describe, it, expect } from 'vitest';
import { extractTitleKey, extractBodyTrailerKeys } from './cross-bundling';

describe('extractTitleKey', () => {
  it('matches bracketed prefix: [LIN-142] title', () => {
    expect(extractTitleKey('[LIN-142] Add rate limits')).toBe('LIN-142');
  });

  it('matches parenthesised prefix: (ABC-78) title', () => {
    expect(extractTitleKey('(ABC-78) fix flaky test')).toBe('ABC-78');
  });

  it('matches colon-separated prefix: LIN-142: title', () => {
    expect(extractTitleKey('LIN-142: Add rate limits')).toBe('LIN-142');
  });

  it('matches space-separated prefix: LIN-142 title', () => {
    expect(extractTitleKey('LIN-142 Add rate limits')).toBe('LIN-142');
  });

  it('matches key embedded mid-title', () => {
    expect(extractTitleKey('Address LIN-142 tail latency')).toBe('LIN-142');
  });

  it('normalises case to uppercase', () => {
    expect(extractTitleKey('lin-142: whatever')).toBe('LIN-142');
  });

  it('returns null for titles without any key', () => {
    expect(extractTitleKey('Refactor auth middleware')).toBeNull();
  });

  it('ignores single-letter prefixes (likely false positives)', () => {
    expect(extractTitleKey('A-1 quick thing')).toBeNull();
  });

  it('returns the first key when multiple are present', () => {
    expect(extractTitleKey('LIN-142 + LIN-200 — combined PR')).toBe('LIN-142');
  });

  it('rejects keys whose letter-prefix contains a digit (not letters-only)', () => {
    // ABCD1-2 — the prefix has a digit, which [A-Z]{2,10} forbids.
    expect(extractTitleKey('ABCD1-2 should not match')).toBeNull();
  });

  it('rejects a key glued to a preceding digit run (word-boundary enforcement)', () => {
    // 123AB-1 — at position 3 ('A'), the preceding '3' is a word char so \b fails.
    // No other position satisfies \b([A-Z]{2,10}-\d+)\b.
    expect(extractTitleKey('123AB-1 should not match')).toBeNull();
  });
});

describe('extractBodyTrailerKeys', () => {
  it('matches "Closes LIN-142"', () => {
    expect(extractBodyTrailerKeys('Closes LIN-142')).toEqual(['LIN-142']);
  });

  it('matches multiple closers in a body', () => {
    expect(extractBodyTrailerKeys('Closes LIN-1\nFixes LIN-2\nRelates to ABC-3')).toEqual(['LIN-1','LIN-2','ABC-3']);
  });

  it('matches case-insensitively, normalises to uppercase', () => {
    expect(extractBodyTrailerKeys('fixes lin-42')).toEqual(['LIN-42']);
  });

  it('does not match unrelated words like "See LIN-typos-142"', () => {
    expect(extractBodyTrailerKeys('See LIN-typos-142')).toEqual([]);
  });

  it('returns [] for empty or missing body', () => {
    expect(extractBodyTrailerKeys('')).toEqual([]);
    expect(extractBodyTrailerKeys(undefined)).toEqual([]);
  });

  it('deduplicates repeated keys', () => {
    expect(extractBodyTrailerKeys('Closes LIN-1. Fixes LIN-1.')).toEqual(['LIN-1']);
  });
});
