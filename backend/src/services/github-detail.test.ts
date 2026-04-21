import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection } from '../types';
import { InsufficientScopeError } from '../types';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { fetchIssueDetails } from './github-detail';

const connection: Connection = {
  id: 'c1',
  user_id: 'u1',
  provider: 'github',
  access_token: 'tok',
  refresh_token: null,
  token_expires_at: null,
  account_id: 'gh-1',
  account_name: 'me',
  account_avatar: 'https://example.com/me.png',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => vi.clearAllMocks());

describe('fetchIssueDetails', () => {
  it('fetches issue + comments and maps to GitHubIssueDetails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ permissions: { push: true, admin: false } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        number: 7,
        state: 'open',
        state_reason: null,
        title: 'Bug',
        body_html: '<p>Details</p>',
        user: { login: 'alice', avatar_url: 'https://example.com/a.png' },
        labels: [{ name: 'bug', color: 'ff0000' }],
        assignees: [{ login: 'bob', avatar_url: 'https://example.com/b.png' }],
        comments: 2,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 101,
          user: { login: 'carol', avatar_url: 'https://example.com/c.png' },
          body_html: '<p>first</p>',
          created_at: '2026-04-20T10:00:00Z',
        },
        {
          id: 102,
          user: { login: 'dave', avatar_url: 'https://example.com/d.png' },
          body_html: '<p>second</p>',
          created_at: '2026-04-20T11:00:00Z',
        },
      ],
    });

    const result = await fetchIssueDetails(connection, 'acme', 'widgets', 7);

    expect(result.kind).toBe('github_issue');
    expect(result.number).toBe(7);
    expect(result.state).toBe('open');
    expect(result.title).toBe('Bug');
    expect(result.bodyHtml).toBe('<p>Details</p>');
    expect(result.author).toEqual({ login: 'alice', avatar: 'https://example.com/a.png' });
    expect(result.labels).toEqual([{ name: 'bug', color: 'ff0000' }]);
    expect(result.assignees).toEqual([{ login: 'bob', avatar: 'https://example.com/b.png' }]);
    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toEqual({
      id: '101',
      author: { name: 'carol', avatar: 'https://example.com/c.png' },
      bodyHtml: '<p>first</p>',
      createdAt: '2026-04-20T10:00:00Z',
    });
    expect(result.commentCount).toBe(2);
    expect(result.permissions).toEqual({ canComment: true, canClose: true });
  });

  it('derives canClose=false when user lacks push permission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ permissions: { push: false, admin: false } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        number: 1, state: 'open', state_reason: null, title: 't',
        body_html: '', user: { login: 'a', avatar_url: '' },
        labels: [], assignees: [], comments: 0,
      }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await fetchIssueDetails(connection, 'acme', 'widgets', 1);
    expect(result.permissions).toEqual({ canComment: true, canClose: false });
  });

  it('throws InsufficientScopeError on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ message: 'forbidden' }) });
    await expect(fetchIssueDetails(connection, 'acme', 'widgets', 7)).rejects.toBeInstanceOf(InsufficientScopeError);
  });
});
