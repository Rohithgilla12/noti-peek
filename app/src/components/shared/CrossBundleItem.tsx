import type { CrossBundleResponse, Provider } from '../../lib/types';
import { NotificationRow as SingleRow } from './NotificationRow';
import { SourceIcon } from './SourceIcon';
import { trackCrossBundleExpanded } from '../../lib/telemetry-events';
import { humanizeType } from '../../lib/notification-labels';

export interface CrossBundleItemProps {
  bundle: CrossBundleResponse;
  expanded: boolean;
  selectedId: string | null;
  onToggleExpand: () => void;
  onSelect: (id: string) => void;
  onOpen: (url: string, id: string) => void;
  onMarkBundleRead?: () => void;
}

function summaryLine(bundle: CrossBundleResponse): string {
  const sourcesList = (Object.keys(bundle.source_summary) as Provider[])
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(' + ');
  const types = Object.entries(bundle.type_summary)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => {
      const label = humanizeType(t);
      return `${n} ${label}${n === 1 ? '' : 's'}`;
    })
    .join(' · ');
  return `${bundle.event_count} updates across ${sourcesList}: ${types}`;
}

export function CrossBundleItem({
  bundle, expanded, selectedId, onToggleExpand, onSelect, onOpen, onMarkBundleRead,
}: CrossBundleItemProps) {
  const unread = bundle.unread_count > 0;
  const linkedCount = bundle.linked.length;
  const time = new Date(bundle.latest_at).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });
  const actorChip = bundle.actors[0]?.name
    ? `@${bundle.actors[0].name}${bundle.extra_actor_count > 0 ? ` +${bundle.extra_actor_count}` : ''}`
    : null;

  return (
    <div className={`cross-bundle-row ${unread ? 'is-unread' : ''}`}>
      <button
        type="button"
        className={`day-row ${unread ? 'unread' : 'read'}`}
        data-source={bundle.primary.source}
        aria-expanded={expanded}
        onClick={() => {
          if (!expanded) trackCrossBundleExpanded(bundle.pair);
          onToggleExpand();
        }}
      >
        <span className="day-row-leader">
          <SourceIcon provider={bundle.primary.source} size={14} />
        </span>

        <span className="day-row-meta">
          <span className="day-row-source">{bundle.primary.source}</span>
          <span className="day-row-sep">·</span>
          <span className="day-row-type">{bundle.primary.key}</span>
          <span className="day-row-time">{time}</span>
        </span>

        <span className="day-row-title">{bundle.primary.title}</span>

        <span className="day-row-preview">{summaryLine(bundle)}</span>

        <span className="day-row-chips">
          <span
            className="day-row-chip"
            title={bundle.linked.map((l) => l.ref).join(', ')}
          >
            +{linkedCount} linked
          </span>
          {actorChip && <span className="day-row-chip">{actorChip}</span>}
        </span>

        <span
          className="day-row-status"
          data-state={unread ? 'unread' : 'read'}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="cross-bundle-children">
          {bundle.children.map((n) => (
            <div key={n.id} className="cross-bundle-child-wrap">
              <span className={`cross-bundle-child-dot source-${n.source}`} aria-hidden="true" />
              <SingleRow
                n={n}
                selected={n.id === selectedId}
                onSelect={() => onSelect(n.id)}
                onOpen={() => onOpen(n.url, n.id)}
              />
            </div>
          ))}
          {onMarkBundleRead && bundle.unread_count > 0 && (
            <div className="cross-bundle-actions">
              <button type="button" className="mark-bundle-read" onClick={onMarkBundleRead}>
                mark all {bundle.unread_count} as read (M)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
