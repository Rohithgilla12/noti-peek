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

import { fetchPRDetails } from './github-detail';

describe('fetchPRDetails', () => {
  it('fetches PR, reviews, and checks and maps to GitHubPRDetails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ permissions: { push: true } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        number: 42,
        state: 'open',
        state_reason: null,
        title: 'Add feature',
        body_html: '<p>PR body</p>',
        user: { login: 'alice', avatar_url: 'https://example.com/a.png' },
        labels: [],
        assignees: [],
        comments: 3,
        draft: false,
        merged: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: { sha: 'abc123' },
      }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { state: 'APPROVED', submitted_at: '2026-04-20T10:00:00Z' },
        { state: 'APPROVED', submitted_at: '2026-04-20T11:00:00Z' },
      ],
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        check_runs: [
          { status: 'completed', conclusion: 'success' },
          { status: 'completed', conclusion: 'failure' },
          { status: 'in_progress', conclusion: null },
        ],
      }),
    });

    const result = await fetchPRDetails(connection, 'acme', 'widgets', 42);
    expect(result.kind).toBe('github_pr');
    expect(result.draft).toBe(false);
    expect(result.merged).toBe(false);
    expect(result.mergeable).toBe(true);
    expect(result.mergeableState).toBe('clean');
    expect(result.reviewDecision).toBe('APPROVED');
    expect(result.checks).toEqual({ passed: 1, failed: 1, pending: 1 });
    expect(result.permissions).toEqual({ canComment: true, canReview: true, canMerge: true, canClose: true });
  });

  it('reviewDecision is CHANGES_REQUESTED when latest review per user requests changes', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ permissions: { push: false } }) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        number: 1, state: 'open', state_reason: null, title: 't',
        body_html: '', user: { login: 'a', avatar_url: '' },
        labels: [], assignees: [], comments: 0,
        draft: false, merged: false, mergeable: null, mergeable_state: 'unknown',
        head: { sha: 's' },
      }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { user: { login: 'x' }, state: 'APPROVED', submitted_at: '2026-04-20T10:00:00Z' },
        { user: { login: 'x' }, state: 'CHANGES_REQUESTED', submitted_at: '2026-04-20T11:00:00Z' },
      ],
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ check_runs: [] }) });

    const result = await fetchPRDetails(connection, 'acme', 'widgets', 1);
    expect(result.reviewDecision).toBe('CHANGES_REQUESTED');
    expect(result.permissions.canMerge).toBe(false);
  });
});

import {
  postIssueComment,
  setIssueState,
  submitPRReview,
  mergePR,
} from './github-detail';

describe('GitHub actions', () => {
  it('postIssueComment POSTs the body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: 1 }) });
    await postIssueComment(connection, 'acme', 'widgets', 7, 'hello');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/acme/widgets/issues/7/comments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ body: 'hello' });
  });

  it('setIssueState PATCHes state and state_reason', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await setIssueState(connection, 'acme', 'widgets', 7, 'closed', 'completed');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ state: 'closed', state_reason: 'completed' });
  });

  it('submitPRReview POSTs event and body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await submitPRReview(connection, 'acme', 'widgets', 42, 'APPROVE', 'lgtm');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/acme/widgets/pulls/42/reviews');
    expect(JSON.parse(init.body)).toEqual({ event: 'APPROVE', body: 'lgtm' });
  });

  it('submitPRReview requires body for REQUEST_CHANGES', async () => {
    await expect(submitPRReview(connection, 'acme', 'widgets', 42, 'REQUEST_CHANGES', '')).rejects.toThrow(/body is required/i);
  });

  it('mergePR PUTs the merge method', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    await mergePR(connection, 'acme', 'widgets', 42, 'squash');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/acme/widgets/pulls/42/merge');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ merge_method: 'squash' });
  });

  it('mergePR maps 405 to a helpful error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 405, json: async () => ({ message: 'Not mergeable' }) });
    await expect(mergePR(connection, 'acme', 'widgets', 42, 'squash')).rejects.toThrow(/not mergeable/i);
  });

  it('action throws InsufficientScopeError on 403', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) });
    await expect(postIssueComment(connection, 'acme', 'widgets', 7, 'x')).rejects.toBeInstanceOf(InsufficientScopeError);
  });
});
