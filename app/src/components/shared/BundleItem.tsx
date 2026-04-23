import type { BundleResponse } from '../../lib/types';
import { NotificationRow as SingleRow } from './NotificationRow';
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
  const actorsLabel = [
    ...bundle.actors.map((a) => `@${a.name}`),
    ...(bundle.extra_actor_count > 0 ? [`+${bundle.extra_actor_count}`] : []),
  ].join(' · ');

  return (
    <div className={`bundle-row ${bundle.unread_count > 0 ? 'is-unread' : ''}`}>
      <button
        type="button"
        className="bundle-header"
        aria-expanded={expanded}
        onClick={onToggleExpand}
      >
        <span className="unread-dot" aria-hidden="true" />
        <div className="bundle-header-body">
          <div className="bundle-title-line">
            <span className={`source-badge source-${bundle.source}`}>{bundle.source}</span>
            <span className="bundle-title">{bundle.title}</span>
            <time className="bundle-time" dateTime={bundle.latest_at}>
              {new Date(bundle.latest_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </time>
          </div>
          <div className="bundle-summary">
            ↳ {bundle.event_count} updates: {summarize(bundle.type_summary)}
          </div>
          <div className="bundle-actors">{actorsLabel}</div>
        </div>
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
