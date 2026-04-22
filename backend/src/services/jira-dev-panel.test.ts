import { describe, it, expect, vi } from 'vitest';
import { fetchJiraDevPanel, parseBitbucketPrsFromDevPanel } from './jira-dev-panel';
import type { Connection } from '../types';

describe('parseBitbucketPrsFromDevPanel', () => {
  it('extracts workspace/repo/id triples from the dev-status response', () => {
    const payload = {
      detail: [{
        pullRequests: [
          { url: 'https://bitbucket.org/myws/myrepo/pull-requests/42' },
          { url: 'https://bitbucket.org/other/project/pull-requests/7' },
        ],
      }],
    };
    expect(parseBitbucketPrsFromDevPanel(payload)).toEqual([
      { kind: 'bitbucket-pr', workspace: 'myws', repo: 'myrepo', id: '42' },
      { kind: 'bitbucket-pr', workspace: 'other', repo: 'project', id: '7' },
    ]);
  });

  it('returns [] for an empty payload', () => {
    expect(parseBitbucketPrsFromDevPanel({ detail: [] })).toEqual([]);
    expect(parseBitbucketPrsFromDevPanel(null as unknown)).toEqual([]);
  });

  it('ignores non-Bitbucket URLs', () => {
    const payload = {
      detail: [{ pullRequests: [{ url: 'https://github.com/o/r/pull/1' }] }],
    };
    expect(parseBitbucketPrsFromDevPanel(payload)).toEqual([]);
  });
});

describe('fetchJiraDevPanel', () => {
  it('builds the correct URL and returns parsed hints', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        detail: [{ pullRequests: [{ url: 'https://bitbucket.org/w/r/pull-requests/9' }] }],
      }),
    } as Response);

    const connection: Connection = {
      id: 'c1', user_id: 'u', provider: 'jira',
      access_token: 'tok', refresh_token: null, token_expires_at: null,
      account_id: 'cloud-id', account_name: 'company',
      account_avatar: null,
      created_at: '', updated_at: '',
    };

    const hints = await fetchJiraDevPanel({
      connection,
      cloudBaseUrl: 'https://company.atlassian.net',
      issueId: '10001',
      fetchImpl: fetchMock,
      timeoutMs: 2000,
    });

    expect(hints).toEqual([{ kind: 'bitbucket-pr', workspace: 'w', repo: 'r', id: '9' }]);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(String(calledUrl)).toContain('/rest/dev-status/1.0/issue/detail');
    expect(String(calledUrl)).toContain('issueId=10001');
    expect(String(calledUrl)).toContain('applicationType=bitbucket');
    expect(String(calledUrl)).toContain('dataType=pullrequest');
  });

  it('returns [] and does not throw on 4xx/5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    const hints = await fetchJiraDevPanel({
      connection: { id: 'c', user_id: 'u', provider: 'jira', access_token: 't',
        refresh_token: null, token_expires_at: null, account_id: 'x', account_name: 'x',
        account_avatar: null, created_at: '', updated_at: '' },
      cloudBaseUrl: 'https://company.atlassian.net',
      issueId: '1',
      fetchImpl: fetchMock, timeoutMs: 2000,
    });
    expect(hints).toEqual([]);
  });

  it('returns [] when the fetch times out', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      new Promise((_res, rej) => setTimeout(() => rej(new Error('abort')), 50)));
    const hints = await fetchJiraDevPanel({
      connection: { id: 'c', user_id: 'u', provider: 'jira', access_token: 't',
        refresh_token: null, token_expires_at: null, account_id: 'x', account_name: 'x',
        account_avatar: null, created_at: '', updated_at: '' },
      cloudBaseUrl: 'https://company.atlassian.net',
      issueId: '1',
      fetchImpl: fetchMock, timeoutMs: 20,
    });
    expect(hints).toEqual([]);
  });
});
