import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, Env } from '../types';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    account_id: '{user-uuid}',
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
    // New flow: workspaces -> PRs/workspace (server-filtered to current user).
    const mockWorkspaces = (slugs: string[] = ['team']) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: slugs.map(slug => ({ workspace: { slug } })),
          size: slugs.length,
        }),
      });
    };

    const mockWorkspacePRs = (prs: unknown[]) => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: prs, size: prs.length }),
      });
    };

    it('should fetch and transform Bitbucket PRs into notifications', async () => {
      mockWorkspaces(['team']);
      mockWorkspacePRs([mockPullRequest]);

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

    it('should call the workspace-scoped per-user PR endpoint with the connection account_id', async () => {
      mockWorkspaces(['team']);
      mockWorkspacePRs([]);

      await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      const prCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(prCallUrl).toContain('/2.0/workspaces/team/pullrequests/');
      expect(prCallUrl).toContain(encodeURIComponent('{user-uuid}'));
      expect(prCallUrl).toContain('state=OPEN');
    });

    it('should handle merged PRs correctly', async () => {
      mockWorkspaces(['team']);
      mockWorkspacePRs([{ ...mockPullRequest, state: 'MERGED' }]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications[0].type).toBe('merged');
    });

    it('should handle declined PRs correctly', async () => {
      mockWorkspaces(['team']);
      mockWorkspacePRs([{ ...mockPullRequest, state: 'DECLINED' }]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications[0].type).toBe('declined');
    });

    it('should handle empty PR response', async () => {
      mockWorkspaces(['team']);
      mockWorkspacePRs([]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(0);
    });

    it('should return empty when user belongs to no workspaces', async () => {
      mockWorkspaces([]);

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw TokenExpiredError on 401 from workspaces', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(fetchBitbucketNotifications(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Bitbucket token expired or revoked'
      );
    });

    it('should throw TokenExpiredError on 401 from PRs endpoint', async () => {
      mockWorkspaces(['team']);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(fetchBitbucketNotifications(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Bitbucket token expired or revoked'
      );
    });

    it('should throw when account_id is missing', async () => {
      const connectionNoAccount = { ...mockConnection, account_id: null };

      await expect(
        fetchBitbucketNotifications(connectionNoAccount, mockEnv, mockDb)
      ).rejects.toThrow('Bitbucket connection missing account_id');
    });

    it('should deduplicate PRs that show up in multiple workspaces', async () => {
      const pr1 = { ...mockPullRequest, id: 1 };
      const pr2 = { ...mockPullRequest, id: 2 };

      mockWorkspaces(['team', 'other']);
      mockWorkspacePRs([pr1, pr2]);
      mockWorkspacePRs([{ ...pr1 }]);

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
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });

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
      await expect(
        markBitbucketNotificationAsRead(mockConnection, 'bitbucket:123')
      ).resolves.not.toThrow();
    });
  });

  describe('markAllBitbucketNotificationsAsRead', () => {
    it('should handle marking all notifications as read', async () => {
      await expect(
        markAllBitbucketNotificationsAsRead(mockConnection)
      ).resolves.not.toThrow();
    });
  });

  describe('token expiration check', () => {
    it('should refresh token when expired before fetching', async () => {
      const expiredConnection = {
        ...mockConnection,
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh',
          expires_in: 7200,
        }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [], size: 0 }),
      });

      await fetchBitbucketNotifications(expiredConnection, mockEnv, mockDb);

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://bitbucket.org/site/oauth2/access_token',
        expect.anything()
      );
    });

    it('should not refresh token when not expired', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [], size: 0 }),
      });

      await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      const firstUrl = mockFetch.mock.calls[0][0] as string;
      expect(firstUrl).toContain('/2.0/user/workspaces');
    });
  });

  describe('PR sorting', () => {
    it('should sort PRs by updated date descending', async () => {
      const olderPR = { ...mockPullRequest, id: 1, updated_on: '2024-01-10T10:00:00Z' };
      const newerPR = { ...mockPullRequest, id: 2, updated_on: '2024-01-15T10:00:00Z' };
      const middlePR = { ...mockPullRequest, id: 3, updated_on: '2024-01-12T10:00:00Z' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [{ workspace: { slug: 'team' } }], size: 1 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ values: [olderPR, middlePR, newerPR], size: 3 }),
      });

      const result = await fetchBitbucketNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications.map(n => n.id)).toEqual([
        'bitbucket:2',
        'bitbucket:3',
        'bitbucket:1',
      ]);
    });
  });
});
