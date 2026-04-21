import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Connection, Env } from '../types';
import { InsufficientScopeError } from '../types';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { parseJiraIssueUrl, fetchJiraIssueDetails, postJiraComment, transitionJiraIssue, assignJiraSelf } from './jira-detail';

const connection: Connection = {
  id: 'c1', user_id: 'u1', provider: 'jira',
  access_token: 'tok', refresh_token: 'refresh',
  token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
  account_id: 'a1', account_name: 'me', account_avatar: '',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

const env: Env = {
  DB: {} as D1Database,
  GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '',
  LINEAR_CLIENT_ID: '', LINEAR_CLIENT_SECRET: '',
  JIRA_CLIENT_ID: 'jid', JIRA_CLIENT_SECRET: 'jsec',
  BITBUCKET_CLIENT_ID: '', BITBUCKET_CLIENT_SECRET: '',
  APP_URL: 'https://app.example.com',
};

const db = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({ run: vi.fn().mockResolvedValue({}) }),
  }),
} as unknown as D1Database;

beforeEach(() => vi.clearAllMocks());

describe('parseJiraIssueUrl', () => {
  it('extracts the issue key from a browse URL', () => {
    expect(parseJiraIssueUrl('https://acme.atlassian.net/browse/TEST-123')).toEqual({ key: 'TEST-123' });
  });
  it('handles trailing slashes and fragments', () => {
    expect(parseJiraIssueUrl('https://acme.atlassian.net/browse/FOO-9/')).toEqual({ key: 'FOO-9' });
    expect(parseJiraIssueUrl('https://acme.atlassian.net/browse/BAR-1?focusedCommentId=1')).toEqual({ key: 'BAR-1' });
  });
  it('returns null for non-issue URLs', () => {
    expect(parseJiraIssueUrl('https://acme.atlassian.net/projects/TEST')).toBeNull();
  });
});

describe('fetchJiraIssueDetails', () => {
  it('fetches issue + transitions + comments + myself and maps them', async () => {
    // accessible-resources
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'cloud-1', url: 'https://acme.atlassian.net', name: 'acme' }] });
    // myself
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accountId: 'me-1', displayName: 'Me', avatarUrls: { '48x48': 'https://example.com/me.png' } }),
    });
    // issue
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key: 'TEST-42',
        fields: {
          summary: 'Fix it',
          status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
          priority: { name: 'High', iconUrl: 'https://example.com/p.png' },
          assignee: { accountId: 'me-1', displayName: 'Me', avatarUrls: { '48x48': 'https://example.com/me.png' } },
          reporter: { accountId: 'rep-1', displayName: 'Rep', avatarUrls: { '48x48': 'https://example.com/rep.png' } },
          comment: { total: 2 },
        },
        renderedFields: { description: '<p>Desc</p>' },
      }),
    });
    // transitions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        transitions: [
          { id: '11', name: 'To Do', to: { name: 'To Do' } },
          { id: '31', name: 'Done', to: { name: 'Done' } },
        ],
      }),
    });
    // comments
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comments: [
          {
            id: '1001',
            author: { accountId: 'c1', displayName: 'Carol', avatarUrls: { '48x48': 'https://example.com/c.png' } },
            renderedBody: '<p>hi</p>',
            created: '2026-04-20T10:00:00Z',
          },
        ],
        total: 2,
      }),
    });

    const details = await fetchJiraIssueDetails(connection, env, db, 'TEST-42');

    expect(details.kind).toBe('jira_issue');
    expect(details.key).toBe('TEST-42');
    expect(details.summary).toBe('Fix it');
    expect(details.status).toEqual({ name: 'In Progress', category: 'indeterminate' });
    expect(details.priority).toEqual({ name: 'High', iconUrl: 'https://example.com/p.png' });
    expect(details.assignee).toEqual({ accountId: 'me-1', displayName: 'Me', avatar: 'https://example.com/me.png' });
    expect(details.descriptionHtml).toBe('<p>Desc</p>');
    expect(details.availableTransitions).toHaveLength(2);
    expect(details.comments).toHaveLength(1);
    expect(details.commentCount).toBe(2);
    expect(details.currentUser).toEqual({ accountId: 'me-1', displayName: 'Me', avatar: 'https://example.com/me.png' });
  });

  it('throws InsufficientScopeError on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'c', url: 'https://acme.atlassian.net', name: 'a' }] });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    await expect(fetchJiraIssueDetails(connection, env, db, 'TEST-1')).rejects.toBeInstanceOf(InsufficientScopeError);
  });
});

describe('Jira actions', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'cloud-1', url: 'https://acme.atlassian.net', name: 'acme' }] });
  });

  it('postJiraComment POSTs ADF body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: '1' }) });
    await postJiraComment(connection, env, db, 'TEST-1', 'hello there');
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe('https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/TEST-1/comment');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.body.type).toBe('doc');
    expect(body.body.content[0].content[0].text).toBe('hello there');
  });

  it('transitionJiraIssue POSTs transition id', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await transitionJiraIssue(connection, env, db, 'TEST-1', '31');
    const [url, init] = mockFetch.mock.calls[1];
    expect(url).toBe('https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/TEST-1/transitions');
    expect(JSON.parse(init.body)).toEqual({ transition: { id: '31' } });
  });

  it('assignJiraSelf fetches myself then PUTs assignee', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ accountId: 'me-1', displayName: 'Me' }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    await assignJiraSelf(connection, env, db, 'TEST-1');
    const [url, init] = mockFetch.mock.calls[2];
    expect(url).toBe('https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/TEST-1/assignee');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ accountId: 'me-1' });
  });

  it('throws InsufficientScopeError on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    await expect(postJiraComment(connection, env, db, 'TEST-1', 'x')).rejects.toBeInstanceOf(InsufficientScopeError);
  });
});
