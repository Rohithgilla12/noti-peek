import DOMPurify from 'dompurify';
import { api } from './api';

const ALLOWED_TAGS = [
  'a', 'b', 'i', 'em', 'strong', 'del', 's', 'u', 'code', 'pre',
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img',
  'span', 'div',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'align'];

// Jira attachment URLs embedded in rendered description HTML. Two forms:
//  - `https://{site}.atlassian.net/rest/api/3/attachment/content/{id}`  (common)
//  - `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/attachment/content/{id}`
// Both require Bearer auth and fail with a broken-image placeholder when
// the Tauri webview tries to load them directly. We rewrite the src to our
// backend proxy, which authenticates the device, fetches with the stored
// Jira token, follows the 303 to the media CDN, and streams bytes back.
const JIRA_ATTACHMENT_RE =
  /https:\/\/(?:[a-z0-9-]+\.atlassian\.net|api\.atlassian\.com\/ex\/jira\/[^/]+)\/rest\/api\/3\/attachment\/content\/(\d+)/gi;

function rewriteJiraAttachmentUrls(html: string): string {
  return html.replace(JIRA_ATTACHMENT_RE, (original, id: string) => {
    const proxied = api.jiraAttachmentUrl(id);
    return proxied ?? original;
  });
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  try {
    const rewritten = rewriteJiraAttachmentUrls(html);
    return DOMPurify.sanitize(rewritten, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'form', 'object', 'embed', 'style'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick'],
    });
  } catch (err) {
    console.error('DOMPurify sanitize failed:', err);
    // Fallback: strip tags via a naive regex so user at least sees text.
    return html.replace(/<[^>]*>/g, '');
  }
}
