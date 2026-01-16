import type { NotificationResponse, Connection, NotificationFetchResult, Env } from '../types';
import { TokenExpiredError } from '../types';

interface BitbucketPullRequest {
  id: number;
  title: string;
  description: string;
  state: string;
  created_on: string;
  updated_on: string;
  author: {
    uuid: string;
    display_name: string;
    links: {
      avatar: { href: string };
    };
  };
  source: {
    branch: { name: string };
    repository: {
      full_name: string;
      name: string;
    };
  };
  destination: {
    branch: { name: string };
    repository: {
      full_name: string;
      name: string;
    };
  };
  links: {
    html: { href: string };
  };
  participants: Array<{
    user: { uuid: string; display_name: string };
    role: string;
    approved: boolean;
  }>;
}

interface BitbucketPaginatedResponse<T> {
  values: T[];
  next?: string;
  page?: number;
  size: number;
}

interface BitbucketTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface BitbucketUser {
  uuid: string;
  display_name: string;
  account_id: string;
  links: {
    avatar: { href: string };
  };
}

interface BitbucketFetchOptions {
  maxPages?: number;
  perPage?: number;
}

function mapPullRequestState(state: string): string {
  const stateMap: Record<string, string> = {
    'OPEN': 'pull_request',
    'MERGED': 'merged',
    'DECLINED': 'declined',
    'SUPERSEDED': 'superseded',
  };
  return stateMap[state] || 'pull_request';
}

function isTokenExpired(connection: Connection): boolean {
  if (!connection.token_expires_at) {
    return false;
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000;

  return expiresAt - bufferMs <= now;
}

export async function refreshBitbucketToken(
  connection: Connection,
  env: Env,
  db: D1Database
): Promise<string> {
  if (!connection.refresh_token) {
    throw new TokenExpiredError('No refresh token available for Bitbucket connection');
  }

  const credentials = btoa(`${env.BITBUCKET_CLIENT_ID}:${env.BITBUCKET_CLIENT_SECRET}`);

  const response = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new TokenExpiredError('Failed to refresh Bitbucket token');
  }

  const tokenData = await response.json() as BitbucketTokenResponse;
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await db.prepare(`
    UPDATE connections
    SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    tokenData.access_token,
    tokenData.refresh_token,
    expiresAt,
    connection.id
  ).run();

  return tokenData.access_token;
}

async function getCurrentUser(accessToken: string): Promise<BitbucketUser> {
  const response = await fetch('https://api.bitbucket.org/2.0/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get Bitbucket user: ${response.status}`);
  }

  return response.json() as Promise<BitbucketUser>;
}

export async function fetchBitbucketNotifications(
  connection: Connection,
  env: Env,
  db: D1Database,
  options: BitbucketFetchOptions = {}
): Promise<NotificationFetchResult> {
  const { maxPages = 5, perPage = 50 } = options;
  let accessToken = connection.access_token;

  if (isTokenExpired(connection)) {
    accessToken = await refreshBitbucketToken(connection, env, db);
  }

  const currentUser = await getCurrentUser(accessToken);
  const allPullRequests: BitbucketPullRequest[] = [];
  let pagesFetched = 0;

  // Fetch PRs where user is a reviewer
  let nextUrl: string | undefined = `https://api.bitbucket.org/2.0/pullrequests/${currentUser.uuid}?pagelen=${perPage}`;

  while (nextUrl && pagesFetched < maxPages) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new TokenExpiredError('Bitbucket token expired or revoked');
      }
      throw new Error(`Bitbucket API error: ${response.status}`);
    }

    const data = await response.json() as BitbucketPaginatedResponse<BitbucketPullRequest>;
    allPullRequests.push(...data.values);

    if (!data.next || data.values.length < perPage) {
      break;
    }

    nextUrl = data.next;
    pagesFetched++;
  }

  // Also fetch PRs authored by the user
  pagesFetched = 0;
  nextUrl = `https://api.bitbucket.org/2.0/repositories?role=member&pagelen=${perPage}`;

  const repoUrls: string[] = [];
  while (nextUrl && pagesFetched < 2) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json() as BitbucketPaginatedResponse<{ full_name: string; links: { pullrequests: { href: string } } }>;
      for (const repo of data.values) {
        repoUrls.push(repo.links.pullrequests.href);
      }
      nextUrl = data.next;
    } else {
      break;
    }
    pagesFetched++;
  }

  // Fetch recent PRs from each repo
  for (const prUrl of repoUrls.slice(0, 10)) {
    try {
      const response = await fetch(`${prUrl}?state=OPEN&pagelen=10`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json() as BitbucketPaginatedResponse<BitbucketPullRequest>;
        for (const pr of data.values) {
          // Only include if user is involved
          const isAuthor = pr.author.uuid === currentUser.uuid;
          const isReviewer = pr.participants.some(p => p.user.uuid === currentUser.uuid);
          if (isAuthor || isReviewer) {
            // Avoid duplicates
            if (!allPullRequests.some(existing => existing.id === pr.id)) {
              allPullRequests.push(pr);
            }
          }
        }
      }
    } catch {
      // Continue on error for individual repos
    }
  }

  // Sort by updated date
  allPullRequests.sort((a, b) =>
    new Date(b.updated_on).getTime() - new Date(a.updated_on).getTime()
  );

  const notifications = allPullRequests.map((pr): NotificationResponse => ({
    id: `bitbucket:${pr.id}`,
    source: 'bitbucket',
    type: mapPullRequestState(pr.state),
    title: pr.title,
    body: `${pr.source.branch.name} → ${pr.destination.branch.name}`,
    url: pr.links.html.href,
    repo: pr.destination.repository.full_name,
    author: {
      name: pr.author.display_name,
      avatar: pr.author.links.avatar.href,
    },
    unread: true, // Bitbucket doesn't have read state for PRs
    createdAt: pr.created_on,
    updatedAt: pr.updated_on,
  }));

  return {
    notifications,
  };
}

export async function markBitbucketNotificationAsRead(
  connection: Connection,
  notificationId: string
): Promise<void> {
  // Bitbucket doesn't have a notification read API
  // The notification ID is the PR ID
  // This maintains API consistency
  console.log(`Marking Bitbucket notification ${notificationId} as read`);
}

export async function markAllBitbucketNotificationsAsRead(
  connection: Connection
): Promise<void> {
  // Bitbucket doesn't have a bulk mark-as-read API
  // This maintains API consistency
  console.log('Marking all Bitbucket notifications as read');
}
