import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusStrip } from './StatusStrip';
import type { NotificationDetails } from '../../lib/types';

const prBase: NotificationDetails = {
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

describe('StatusStrip', () => {
  it('renders the aggregate checks badge for github_pr', () => {
    render(<StatusStrip details={prBase} />);
    expect(screen.getByText(/checks/i)).not.toBeNull();
  });

  it('renders per-check pills when details.checkRuns is present', () => {
    const details = {
      ...prBase,
      checkRuns: [
        { name: 'ci',     state: 'success', durationMs: 134_000 },
        { name: 'test',   state: 'success', durationMs: 47_000  },
        { name: 'build',  state: 'success', durationMs: 62_000  },
        { name: 'deploy', state: 'pending', durationMs: null    },
      ],
    } as unknown as NotificationDetails;

    render(<StatusStrip details={details} />);
    expect(screen.getByText('ci')).not.toBeNull();
    expect(screen.getByText('test')).not.toBeNull();
    expect(screen.getByText('build')).not.toBeNull();
    expect(screen.getByText('deploy')).not.toBeNull();
    expect(screen.getByText(/2m 14s|2:14/)).not.toBeNull();
    expect(screen.getByText('pending')).not.toBeNull();
  });
});
