import type { LinkHint } from '../types';

export interface LinearAttachmentLike { url: string }

const GITHUB_ISSUE_OR_PR = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull|issues)\/\d+/i;

export function linkHintsFromAttachments(
  attachments: LinearAttachmentLike[] | undefined,
): LinkHint[] {
  if (!attachments || attachments.length === 0) return [];
  const out: LinkHint[] = [];
  for (const a of attachments) {
    if (!a.url) continue;
    if (GITHUB_ISSUE_OR_PR.test(a.url)) {
      out.push({ kind: 'github-url', url: a.url });
    }
  }
  return out;
}
