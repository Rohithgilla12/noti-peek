import type { BundleResponse } from '../../lib/types';
import { NotificationRow as SingleRow } from './NotificationRow';
import { SourceIcon } from './SourceIcon';
import { humanizeType } from '../../lib/notification-labels';

export interface BundleItemProps {
  bundle: BundleResponse;
  expanded: boolean;
  selectedId: string | null;
  onToggleExpand: () => void;
  onSelect: (id: string) => void;
  onOpen: (url: string, id: string) => void;
}

function summarize(typeSummary: Record<string, number>): string {
  const parts = Object.entries(typeSummary).sort((a, b) => b[1] - a[1]);
  return parts.map(([t, n]) => {
    const label = humanizeType(t);
    return `${n} ${label}${n === 1 ? '' : 's'}`;
  }).join(' · ');
}

export function BundleItem({ bundle, expanded, selectedId, onToggleExpand, onSelect, onOpen }: BundleItemProps) {
  const unread = bundle.unread_count > 0;
  const summary = summarize(bundle.type_summary);
  const time = new Date(bundle.latest_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const actorChip = bundle.actors[0]?.name
    ? `@${bundle.actors[0].name}${bundle.extra_actor_count > 0 ? ` +${bundle.extra_actor_count}` : ''}`
    : null;

  return (
    <div className={`bundle-row ${unread ? 'is-unread' : ''}`}>
      <button
        type="button"
        className={`day-row ${unread ? 'unread' : 'read'}`}
        data-source={bundle.source}
        aria-expanded={expanded}
        onClick={onToggleExpand}
      >
        <span className="day-row-leader">
          <SourceIcon provider={bundle.source} size={14} />
        </span>

        <span className="day-row-meta">
          <span className="day-row-source">{bundle.source}</span>
          <span className="day-row-sep">·</span>
          <span className="day-row-type">{bundle.event_count} updates</span>
          <span className="day-row-time">{time}</span>
        </span>

        <span className="day-row-title">{bundle.title}</span>

        <span className="day-row-preview">{summary}</span>

        <span className="day-row-chips">
          {actorChip && <span className="day-row-chip">{actorChip}</span>}
        </span>

        <span
          className="day-row-status"
          data-state={unread ? 'unread' : 'read'}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="bundle-children">
          {bundle.children.map((n) => (
            <SingleRow
              key={n.id}
              n={n}
              selected={n.id === selectedId}
              onSelect={() => onSelect(n.id)}
              onOpen={() => onOpen(n.url, n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
