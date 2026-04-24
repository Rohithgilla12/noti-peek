import type { Connection, Env } from '../types';
import { TokenExpiredError } from '../types';
import { getAccessToken, getCloudId } from './jira-detail';

/** Fetches a Jira attachment for the given user and streams it back.
 *
 * Jira attachment URLs (`https://{site}.atlassian.net/rest/api/3/attachment/content/{id}`)
 * require an `Authorization: Bearer` header, which a plain `<img>` can't
 * supply — that's why inline images in Jira issue descriptions render as
 * broken placeholders in the app. This helper does the authed fetch via
 * the OAuth gateway; Atlassian replies with a 303 redirect to a
 * short-lived signed URL on `api.media.atlassian.com`, which we follow
 * automatically. The Authorization header is stripped by the platform on
 * the cross-origin redirect (correct — the signed URL carries its own
 * token), and we hand the resulting image stream to the caller. */
export async function fetchJiraAttachmentStream(
  connection: Connection,
  env: Env,
  db: D1Database,
  attachmentId: string,
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string; contentLength: string | null }> {
  const token = await getAccessToken(connection, env, db);
  const { cloudId } = await getCloudId(token);
  const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/attachment/content/${attachmentId}`;

  // Do NOT set `Accept: image/*` — Atlassian's edge gateway will reply
  // 406 Not Acceptable. Leaving it blank lets the gateway 303 us to the
  // media CDN, which sets the real Content-Type on the final response.
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  });
  if (res.status === 401) throw new TokenExpiredError('Jira token expired or revoked');
  if (!res.ok) throw new Error(`jira attachment ${attachmentId} returned ${res.status}`);
  if (!res.body) throw new Error(`jira attachment ${attachmentId} empty body`);

  return {
    body: res.body,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    contentLength: res.headers.get('content-length'),
  };
}
