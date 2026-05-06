import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetadataGrid } from './MetadataGrid';
import type { NotificationDetails } from '../../lib/types';

describe('MetadataGrid', () => {
  it('renders Repository / Branch / Author / Updated for github_pr', () => {
    const details: NotificationDetails = {
      kind: 'github_pr',
      state: 'open',
      merged: false,
      draft: false,
      reviewDecision: null,
      mergeable: true,
      mergeableState: 'clean',
      checks: { passed: 3, failed: 0, pending: 0 },
      comments: [],
      commentCount: 0,
      bodyHtml: '',
    } as unknown as NotificationDetails;

    render(
      <MetadataGrid
        details={details}
        repo="owner/repo"
        branch="feat/x"
        author="alice"
        updatedAt={new Date('2026-05-01').toISOString()}
      />
    );

    expect(screen.getByText('Repository')).not.toBeNull();
    expect(screen.getByText('owner/repo')).not.toBeNull();
    expect(screen.getByText('Branch')).not.toBeNull();
    expect(screen.getByText('feat/x')).not.toBeNull();
    expect(screen.getByText('Author')).not.toBeNull();
    expect(screen.getByText('alice')).not.toBeNull();
  });

  it('renders Project / Status / Assignee / Updated for jira_issue', () => {
    const details: NotificationDetails = {
      kind: 'jira_issue',
      status: { name: 'In Progress', category: 'indeterminate' },
      priority: null,
      assignee: { displayName: 'Bob', accountId: 'b' },
      currentUser: { accountId: 'me' },
      descriptionHtml: '',
      comments: [],
      commentCount: 0,
    } as unknown as NotificationDetails;

    render(
      <MetadataGrid
        details={details}
        project="ENG"
        author="Alice"
        updatedAt={new Date('2026-05-01').toISOString()}
      />
    );

    expect(screen.getByText('Project')).not.toBeNull();
    expect(screen.getByText('ENG')).not.toBeNull();
    expect(screen.getByText('Status')).not.toBeNull();
    expect(screen.getByText('In Progress')).not.toBeNull();
    expect(screen.getByText('Assignee')).not.toBeNull();
    expect(screen.getByText('Bob')).not.toBeNull();
  });

  it('renders an em-dash for missing values', () => {
    const details: NotificationDetails = {
      kind: 'github_issue',
      state: 'open',
      labels: [],
      comments: [],
      commentCount: 0,
      bodyHtml: '',
    } as unknown as NotificationDetails;

    render(
      <MetadataGrid
        details={details}
        repo={undefined}
        author={undefined}
        updatedAt={new Date('2026-05-01').toISOString()}
      />
    );

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
