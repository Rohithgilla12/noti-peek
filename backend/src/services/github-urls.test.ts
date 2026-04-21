import { describe, it, expect } from 'vitest';
import { parseGitHubIssueOrPRUrl } from './github-urls';

describe('parseGitHubIssueOrPRUrl', () => {
  it('parses a PR URL', () => {
    const result = parseGitHubIssueOrPRUrl('https://github.com/acme/widgets/pull/42');
    expect(result).toEqual({ owner: 'acme', repo: 'widgets', number: 42, kind: 'pr' });
  });

  it('parses an issue URL', () => {
    const result = parseGitHubIssueOrPRUrl('https://github.com/acme/widgets/issues/7');
    expect(result).toEqual({ owner: 'acme', repo: 'widgets', number: 7, kind: 'issue' });
  });

  it('parses a URL with trailing slash', () => {
    const result = parseGitHubIssueOrPRUrl('https://github.com/acme/widgets/pull/42/');
    expect(result).toEqual({ owner: 'acme', repo: 'widgets', number: 42, kind: 'pr' });
  });

  it('parses a URL with fragment', () => {
    const result = parseGitHubIssueOrPRUrl('https://github.com/acme/widgets/issues/7#issuecomment-99');
    expect(result).toEqual({ owner: 'acme', repo: 'widgets', number: 7, kind: 'issue' });
  });

  it('returns null for non-issue/PR URLs', () => {
    expect(parseGitHubIssueOrPRUrl('https://github.com/acme/widgets')).toBeNull();
    expect(parseGitHubIssueOrPRUrl('https://github.com/acme/widgets/releases/tag/v1')).toBeNull();
    expect(parseGitHubIssueOrPRUrl('not a url')).toBeNull();
  });
});
