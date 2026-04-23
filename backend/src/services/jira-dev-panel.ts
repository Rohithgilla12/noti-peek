import type { LinkHint, Connection } from '../types';

interface DevPanelPR { url?: string }
interface DevPanelDetail { pullRequests?: DevPanelPR[] }
interface DevPanelPayload { detail?: DevPanelDetail[] }

const BITBUCKET_PR_URL =
  /^https:\/\/bitbucket\.org\/([^/]+)\/([^/]+)\/pull-requests\/(\d+)/i;

export function parseBitbucketPrsFromDevPanel(
  payload: unknown,
): Array<Extract<LinkHint, { kind: 'bitbucket-pr' }>> {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as DevPanelPayload;
  const out: Array<Extract<LinkHint, { kind: 'bitbucket-pr' }>> = [];
  const details = Array.isArray(p.detail) ? p.detail : [];
  for (const d of details) {
    if (!d || typeof d !== 'object') continue;
    const pullRequests = Array.isArray((d as DevPanelDetail).pullRequests) ? (d as DevPanelDetail).pullRequests! : [];
    for (const pr of pullRequests) {
      if (!pr || typeof pr.url !== 'string') continue;
      const m = pr.url.match(BITBUCKET_PR_URL);
      if (m) out.push({ kind: 'bitbucket-pr', workspace: m[1], repo: m[2], id: m[3] });
    }
  }
  return out;
}

export interface FetchDevPanelInput {
  connection: Connection;
  cloudBaseUrl: string;
  issueId: string;
  fetchImpl?: typeof fetch;
  timeoutMs: number;
}

export async function fetchJiraDevPanel(
  input: FetchDevPanelInput,
): Promise<Array<Extract<LinkHint, { kind: 'bitbucket-pr' }>>> {
  const { connection, cloudBaseUrl, issueId, fetchImpl = fetch, timeoutMs } = input;
  const url =
    `${cloudBaseUrl}/rest/dev-status/1.0/issue/detail?issueId=${encodeURIComponent(issueId)}` +
    `&applicationType=bitbucket&dataType=pullrequest`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = await response.json().catch(() => null);
    return parseBitbucketPrsFromDevPanel(json);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
