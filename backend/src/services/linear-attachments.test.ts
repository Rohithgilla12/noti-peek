import { describe, it, expect } from 'vitest';
import { linkHintsFromAttachments } from './linear-attachments';

describe('linkHintsFromAttachments', () => {
  it('returns github-url hints for attachments pointing at GitHub PRs or issues', () => {
    const hints = linkHintsFromAttachments([
      { url: 'https://github.com/o/r/pull/423' },
      { url: 'https://github.com/o/r/issues/1' },
    ]);
    expect(hints).toEqual([
      { kind: 'github-url', url: 'https://github.com/o/r/pull/423' },
      { kind: 'github-url', url: 'https://github.com/o/r/issues/1' },
    ]);
  });

  it('ignores non-GitHub URLs', () => {
    expect(linkHintsFromAttachments([
      { url: 'https://docs.google.com/document/d/123' },
      { url: 'https://slack.com/archives/X/p1' },
    ])).toEqual([]);
  });

  it('ignores GitHub URLs that are not pulls or issues', () => {
    expect(linkHintsFromAttachments([
      { url: 'https://github.com/o/r/commits/main' },
      { url: 'https://github.com/o/r/actions/runs/1' },
    ])).toEqual([]);
  });

  it('tolerates undefined/empty input', () => {
    expect(linkHintsFromAttachments(undefined)).toEqual([]);
    expect(linkHintsFromAttachments([])).toEqual([]);
  });
});
