import type { NotificationDetails } from '../../lib/types';

interface Props {
  details: NotificationDetails;
  currentUserIsAssignee?: boolean;
}

function Badge({ tone, children }: { tone: 'open' | 'closed' | 'merged' | 'neutral' | 'good' | 'bad' | 'warn'; children: React.ReactNode }) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}

export function StatusStrip({ details }: Props) {
  if (details.kind === 'github_issue') {
    return (
      <div className="status-strip">
        <Badge tone={details.state === 'open' ? 'open' : 'closed'}>
          {details.state}{details.stateReason ? ` · ${details.stateReason.replace('_', ' ')}` : ''}
        </Badge>
        {details.labels.slice(0, 6).map((l) => (
          <span key={l.name} className="status-label" style={{ ['--label-color' as string]: `#${l.color}` }}>
            {l.name}
          </span>
        ))}
      </div>
    );
  }

  if (details.kind === 'github_pr') {
    const { checks } = details;
    const checksOk = checks.failed === 0 && checks.pending === 0;
    const checksTone = checks.failed > 0 ? 'bad' : checks.pending > 0 ? 'warn' : 'good';
    return (
      <div className="status-strip">
        <Badge tone={details.merged ? 'merged' : details.state === 'open' ? 'open' : 'closed'}>
          {details.merged ? 'merged' : details.state}
        </Badge>
        {details.draft && <Badge tone="neutral">draft</Badge>}
        {details.reviewDecision && (
          <Badge tone={details.reviewDecision === 'APPROVED' ? 'good' : details.reviewDecision === 'CHANGES_REQUESTED' ? 'bad' : 'neutral'}>
            {details.reviewDecision.replace('_', ' ').toLowerCase()}
          </Badge>
        )}
        <Badge tone={checksTone}>
          checks {checksOk ? '✓' : `${checks.passed}✓ ${checks.failed}✗ ${checks.pending}…`}
        </Badge>
        {details.mergeable === false && <Badge tone="warn">{details.mergeableState || 'not mergeable'}</Badge>}
      </div>
    );
  }

  // jira_issue
  return (
    <div className="status-strip">
      <Badge tone={details.status.category === 'done' ? 'good' : details.status.category === 'indeterminate' ? 'warn' : 'neutral'}>
        {details.status.name}
      </Badge>
      {details.priority && <Badge tone="neutral">{details.priority.name}</Badge>}
      {details.assignee && (
        <span className="status-assignee">
          {details.assignee.accountId === details.currentUser.accountId ? '@you' : `@${details.assignee.displayName}`}
        </span>
      )}
    </div>
  );
}
