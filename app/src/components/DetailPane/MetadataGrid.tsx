import type { NotificationDetails } from '../../lib/types';

interface Props {
  details: NotificationDetails;
  repo?: string;
  project?: string;
  branch?: string;
  author?: string;
  updatedAt: string;
}

function formatUpdated(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Cell({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="meta-cell">
      <div className="meta-cell-label">{label}</div>
      <div className="meta-cell-value">{value || '—'}</div>
    </div>
  );
}

export function MetadataGrid(props: Props) {
  const { details, repo, project, branch, author, updatedAt } = props;
  const updatedLabel = formatUpdated(updatedAt);

  if (details.kind === 'jira_issue') {
    const status = details.status.name;
    const assignee = details.assignee?.displayName ?? null;
    return (
      <div className="meta-grid">
        <Cell label="Project" value={project} />
        <Cell label="Status" value={status} />
        <Cell label="Assignee" value={assignee} />
        <Cell label="Updated" value={updatedLabel} />
      </div>
    );
  }

  return (
    <div className="meta-grid">
      <Cell label="Repository" value={repo} />
      <Cell label="Branch" value={branch} />
      <Cell label="Author" value={author} />
      <Cell label="Updated" value={updatedLabel} />
    </div>
  );
}
