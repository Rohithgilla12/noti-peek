import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, Env } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import after mocking
import {
  fetchBitbucketNotifications,
  refreshBitbucketToken,
  markBitbucketNotificationAsRead,
  markAllBitbucketNotificationsAsRead,
} from './bitbucket';

describe('Bitbucket Service', () => {
  const mockConnection: Connection = {
    id: 'conn-123',
    user_id: 'user-456',
    provider: 'bitbucket',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    account_id: '{account-uuid}',
    account_name: 'Test User',
    account_avatar: 'https://example.com/avatar.png',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockEnv: Env = {
    DB: {} as D1Database,
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    LINEAR_CLIENT_ID: 'linear-client-id',
    LINEAR_CLIENT_SECRET: 'linear-client-secret',
    JIRA_CLIENT_ID: 'jira-client-id',
    JIRA_CLIENT_SECRET: 'jira-client-secret',
    BITBUCKET_CLIENT_ID: 'bitbucket-client-id',
    BITBUCKET_CLIENT_SECRET: 'bitbucket-client-secret',
    APP_URL: 'https://app.example.com',
  };

  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({}),
      }),
    }),
  } as unknown as D1Database;

  const mockPullRequest = {
    id: 123,
    title: 'Add new feature',
    description: 'This PR adds a cool new feature',
    state: 'OPEN',
    created_on: '2024-01-14T10:00:00Z',
    updated_on: '2024-01-15T14:30:00Z',
    author: {
      uuid: '{author-uuid}',
      display_name: 'John Doe',
      links: {
        avatar: { href: 'https://avatar.bitbucket.org/john' },
      },
    },
    source: {
      branch: { name: 'feature/new-stuff' },
      repository: { full_name: 'team/repo', name: 'repo' },
    },
    destination: {
      branch: { name: 'main' },
      repository: { full_name: 'team/repo', name: 'repo' },
    },
    links: {
      html: { href: 'https://bitbucket.org/team/repo/pull-requests/123' },
    },
    participants: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchBitbucketNotifications', () => {
    // Helpers for the new fetch flow: user -> workspaces -> repos/workspace -> PRs/repo.
    const mockUser = (uuid = '{user-uuid}') => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          uuid,
          display_name: 'Test User',
          account_id: 'account-123',
          links: { avatar: { href: 'https://avatar.url' } },
        }),
      });
    };

    const mockWorkspaces = (slugs: string[] = ['team']) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: slugs.map(slug => ({ workspace: { slug } })),
          size: slugs.length,
        }),
      });
    };

    const mockRepos = (
      repos: Array<{ full_name: string; pullrequestsUrl: string }> = [
        { full_name: 'team/repo', pullrequestsUrl: 'https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests' },
      ],
    ) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: repos.map(r => ({
            full_name: r.full_name,
            links: { pullrequests: { href: r.pullrequestsUrl } },
          })),
          size: repos.length,
        }),
      });
    };

    const mockRepoPRs = (prs: unknown[]) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: prs, size: prs.length }),
      });
    };

    it('should fetch and transform Bitbucket PRs into notifications', async () => {
      const authoredPR = { ...mockPullRequest, author: { ...mockPullRequest.author, uuid: '{user-uuid}' } };

      mockUser();
      mockWorkspaces(['team']);
      mockRepos();
      mockRepoPRs([authoredPR]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toMatchObject({
        id: 'bitbucket:123',
        source: 'bitbucket',
        type: 'pull_request',
        title: 'Add new feature',
        body: 'feature/new-stuff → main',
        url: 'https://bitbucket.org/team/repo/pull-requests/123',
        repo: 'team/repo',
        unread: true,
      });
    });

    it('should handle merged PRs correctly', async () => {
      const mergedPR = { ...mockPullRequest, state: 'MERGED', author: { ...mockPullRequest.author, uuid: '{user-uuid}' } };

      mockUser();
      mockWorkspaces(['team']);
      mockRepos();
      mockRepoPRs([mergedPR]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications[0].type).toBe('merged');
    });

    it('should handle declined PRs correctly', async () => {
      const declinedPR = { ...mockPullRequest, state: 'DECLINED', author: { ...mockPullRequest.author, uuid: '{user-uuid}' } };

      mockUser();
      mockWorkspaces(['team']);
      mockRepos();
      mockRepoPRs([declinedPR]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications[0].type).toBe('declined');
    });

    it('should handle empty PR response', async () => {
      mockUser();
      mockWorkspaces(['team']);
      mockRepos();
      mockRepoPRs([]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(0);
    });

    it('should throw TokenExpiredError on 401 response from workspaces', async () => {
      mockUser();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchBitbucketNotifications(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Bitbucket token expired or revoked'
      );
    });

    it('should filter out PRs the user is not involved in', async () => {
      const strangerPR = { ...mockPullRequest, id: 999, author: { ...mockPullRequest.author, uuid: '{someone-else}' }, participants: [] };

      mockUser();
      mockWorkspaces(['team']);
      mockRepos();
      mockRepoPRs([strangerPR]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(0);
    });

    it('should deduplicate PRs across repos', async () => {
      const pr1 = { ...mockPullRequest, id: 1, author: { ...mockPullRequest.author, uuid: '{user-uuid}' } };
      const pr2 = { ...mockPullRequest, id: 2, author: { ...mockPullRequest.author, uuid: '{user-uuid}' } };

      mockUser();
      mockWorkspaces(['team']);
      mockRepos([
        { full_name: 'team/repo', pullrequestsUrl: 'https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests' },
        { full_name: 'team/other', pullrequestsUrl: 'https://api.bitbucket.org/2.0/repositories/team/other/pullrequests' },
      ]);
      mockRepoPRs([pr1, pr2]);
      mockRepoPRs([{ ...pr1 }]); // same id as pr1 from a different repo listing

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications.map(n => n.id).sort()).toEqual(['bitbucket:1', 'bitbucket:2']);
    });
  });

  describe('refreshBitbucketToken', () => {
    it('should refresh token and update database', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 7200,
          token_type: 'bearer',
        }),
      });

      const newToken = await refreshBitbucketToken(mockConnection, mockEnv, mockDb);

      expect(newToken).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://bitbucket.org/site/oauth2/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic '),
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should throw TokenExpiredError when no refresh token available', async () => {
      const connectionWithoutRefresh = { ...mockConnection, refresh_token: null };

      await expect(refreshBitbucketToken(connectionWithoutRefresh, mockEnv, mockDb)).rejects.toThrow(
        'No refresh token available for Bitbucket connection'
      );
    });

    it('should throw TokenExpiredError on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(refreshBitbucketToken(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Failed to refresh Bitbucket token'
      );
    });

    it('should use Basic auth with client credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        }),
      });

      await refreshBitbucketToken(mockConnection, mockEnv, mockDb);

      const fetchCall = mockFetch.mock.calls[0];
      const authHeader = fetchCall[1].headers['Authorization'];
      const expectedAuth = 'Basic ' + btoa('bitbucket-client-id:bitbucket-client-secret');
      expect(authHeader).toBe(expectedAuth);
    });
  });

  describe('markBitbucketNotificationAsRead', () => {
    it('should handle marking notification as read', async () => {
      // This is a no-op in Bitbucket, but we test it doesn't throw
      await expect(
        markBitbucketNotificationAsRead(mockConnection, 'bitbucket:123')
      ).resolves.not.toThrow();
    });
  });

  describe('markAllBitbucketNotificationsAsRead', () => {
    it('should handle marking all notifications as read', async () => {
      // This is a no-op in Bitbucket, but we test it doesn't throw
      await expect(
        markAllBitbucketNotificationsAsRead(mockConnection)
      ).resolves.not.toThrow();
    });
  });

  describe('token expiration check', () => {
    it('should refresh token when expired', async () => {
      const expiredConnection = {
        ...mockConnection,
        token_expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
      };

      // Mock refresh token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      });

      // user -> workspaces -> repos
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: '{user-uuid}', display_name: 'Test User' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [], size: 0 }),
      });

      await fetchBitbucketNotifications(expiredConnection, mockEnv, mockDb);

      // Verify refresh was called first
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://bitbucket.org/site/oauth2/access_token',
        expect.anything()
      );
    });

    it('should not refresh token when not expired', async () => {
      // user -> workspaces (empty, so no repo fetches)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: '{user-uuid}', display_name: 'Test User' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [], size: 0 }),
      });

      await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      // First call should be to user endpoint, not token refresh
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.bitbucket.org/2.0/user',
        expect.anything()
      );
    });
  });

  describe('PR sorting', () => {
    it('should sort PRs by updated date descending', async () => {
      const me = { ...mockPullRequest.author, uuid: '{user-uuid}' };
      const olderPR = { ...mockPullRequest, id: 1, updated_on: '2024-01-10T10:00:00Z', author: me };
      const newerPR = { ...mockPullRequest, id: 2, updated_on: '2024-01-15T10:00:00Z', author: me };
      const middlePR = { ...mockPullRequest, id: 3, updated_on: '2024-01-12T10:00:00Z', author: me };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: '{user-uuid}', display_name: 'Test User' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [{ workspace: { slug: 'team' } }],
          size: 1,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [{
            full_name: 'team/repo',
            links: { pullrequests: { href: 'https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests' } },
          }],
          size: 1,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [olderPR, middlePR, newerPR], size: 3 }),
      });

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      // Should be sorted newest first
      expect(result.notifications.map(n => n.id)).toEqual([
        'bitbucket:2', // newest
        'bitbucket:3', // middle
        'bitbucket:1', // oldest
      ]);
    });
  });
});
