export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  number: number;
  kind: 'issue' | 'pr';
}

const URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/;

export function parseGitHubIssueOrPRUrl(url: string): ParsedGitHubUrl | null {
  const match = URL_RE.exec(url);
  if (!match) return null;
  const [, owner, repo, segment, numberStr] = match;
  return {
    owner,
    repo,
    number: Number.parseInt(numberStr, 10),
    kind: segment === 'pull' ? 'pr' : 'issue',
  };
}
