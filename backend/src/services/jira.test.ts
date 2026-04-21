import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, Env } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import after mocking
import {
  fetchJiraNotifications,
  refreshJiraToken,
  markJiraNotificationAsRead,
  markAllJiraNotificationsAsRead,
} from './jira';

describe('Jira Service', () => {
  const mockConnection: Connection = {
    id: 'conn-123',
    user_id: 'user-456',
    provider: 'jira',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    account_id: 'account-789',
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchJiraNotifications', () => {
    it('should fetch and transform Jira issues into notifications', async () => {
      // Mock cloud resources response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'cloud-123', url: 'https://test.atlassian.net', name: 'Test Site' }],
      });

      // Mock issues search response (POST /rest/api/3/search/jql)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [
            {
              id: '10001',
              key: 'TEST-123',
              fields: {
                summary: 'Fix login bug',
                updated: '2024-01-15T10:30:00Z',
                created: '2024-01-14T09:00:00Z',
                status: { name: 'In Progress' },
                project: { key: 'TEST', name: 'Test Project' },
                assignee: { accountId: 'user-123', displayName: 'Test User', avatarUrls: { '48x48': 'https://avatar.url' } },
                reporter: { accountId: 'reporter-123', displayName: 'Reporter User', avatarUrls: { '48x48': 'https://reporter.avatar' } },
              },
              self: 'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/issue/10001',
            },
            {
              id: '10002',
              key: 'TEST-124',
              fields: {
                summary: 'Add dark mode',
                updated: '2024-01-15T11:00:00Z',
                created: '2024-01-15T08:00:00Z',
                status: { name: 'To Do' },
                project: { key: 'TEST', name: 'Test Project' },
                assignee: null,
                reporter: { accountId: 'reporter-456', displayName: 'Another Reporter', avatarUrls: { '48x48': 'https://another.avatar' } },
              },
              self: 'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/issue/10002',
            },
          ],
          isLast: true,
        }),
      });

      const result = await fetchJiraNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0]).toMatchObject({
        id: 'jira:10001',
        source: 'jira',
        type: 'assigned',
        title: 'TEST-123: Fix login bug',
        project: 'TEST',
        url: 'https://test.atlassian.net/browse/TEST-123',
        updatedAt: '2024-01-15T10:30:00Z',
      });
      expect(result.notifications[1]).toMatchObject({
        id: 'jira:10002',
        source: 'jira',
        type: 'watching',
        title: 'TEST-124: Add dark mode',
        url: 'https://test.atlassian.net/browse/TEST-124',
      });
    });

    it('should handle empty issues response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'cloud-123', url: 'https://test.atlassian.net', name: 'Test Site' }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [],
          isLast: true,
        }),
      });

      const result = await fetchJiraNotifications(mockConnection, mockEnv, mockDb);

      expect(result.notifications).toHaveLength(0);
    });

    it('should throw TokenExpiredError on 401 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'cloud-123', url: 'https://test.atlassian.net', name: 'Test Site' }],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      await expect(fetchJiraNotifications(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Jira token expired or revoked'
      );
    });

    it('should throw error when no cloud resources available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await expect(fetchJiraNotifications(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'No Jira cloud resources available'
      );
    });
  });

  describe('refreshJiraToken', () => {
    it('should refresh token and update database', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });

      const newToken = await refreshJiraToken(mockConnection, mockEnv, mockDb);

      expect(newToken).toBe('new-access-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.atlassian.com/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should throw TokenExpiredError when no refresh token available', async () => {
      const connectionWithoutRefresh = { ...mockConnection, refresh_token: null };

      await expect(refreshJiraToken(connectionWithoutRefresh, mockEnv, mockDb)).rejects.toThrow(
        'No refresh token available for Jira connection'
      );
    });

    it('should throw TokenExpiredError on failed refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(refreshJiraToken(mockConnection, mockEnv, mockDb)).rejects.toThrow(
        'Failed to refresh Jira token'
      );
    });
  });

  describe('markJiraNotificationAsRead', () => {
    it('should handle marking notification as read', async () => {
      // This is a no-op in Jira, but we test it doesn't throw
      await expect(
        markJiraNotificationAsRead(mockConnection, 'jira:10001', mockEnv, mockDb)
      ).resolves.not.toThrow();
    });
  });

  describe('markAllJiraNotificationsAsRead', () => {
    it('should handle marking all notifications as read', async () => {
      // This is a no-op in Jira, but we test it doesn't throw
      await expect(
        markAllJiraNotificationsAsRead(mockConnection, mockEnv, mockDb)
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
          expires_in: 3600,
        }),
      });

      // Mock cloud resources
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'cloud-123', url: 'https://test.atlassian.net', name: 'Test' }],
      });

      // Mock issues
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ issues: [], isLast: true }),
      });

      await fetchJiraNotifications(expiredConnection, mockEnv, mockDb);

      // Verify refresh was called first
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://auth.atlassian.com/oauth/token',
        expect.anything()
      );
    });
  });
});
