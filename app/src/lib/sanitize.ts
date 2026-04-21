import DOMPurify from 'dompurify';

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

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'form', 'object', 'embed', 'style'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  });
}
