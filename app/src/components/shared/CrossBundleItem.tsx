import type { CrossBundleResponse, Provider } from '../../lib/types';
import { NotificationRow as SingleRow } from './NotificationRow';

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
    .map(([t, n]) => `${n} ${t}${n === 1 ? '' : 's'}`)
    .join(' · ');
  return `${bundle.event_count} updates across ${sourcesList}: ${types}`;
}

export function CrossBundleItem({
  bundle, expanded, selectedId, onToggleExpand, onSelect, onOpen, onMarkBundleRead,
}: CrossBundleItemProps) {
  const actorsLabel = [
    ...bundle.actors.map((a) => `@${a.name}`),
    ...(bundle.extra_actor_count > 0 ? [`+${bundle.extra_actor_count}`] : []),
  ].join(' · ');

  const linkedCount = bundle.linked.length;
  const primaryTimeStr = new Date(bundle.latest_at).toLocaleTimeString([], {
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <div className={`cross-bundle-row ${bundle.unread_count > 0 ? 'is-unread' : ''}`}>
      <button
        type="button"
        className="cross-bundle-header"
        aria-expanded={expanded}
        onClick={onToggleExpand}
      >
        <span className="unread-dot" aria-hidden="true" />
        <div className="cross-bundle-body">
          <div className="cross-bundle-title-line">
            <span className={`source-badge source-${bundle.primary.source}`}>{bundle.primary.key}</span>
            <span className="cross-bundle-title">{bundle.primary.title}</span>
            <span
              className="linked-pill"
              title={bundle.linked.map((l) => l.ref).join(', ')}
            >
              +{linkedCount} linked
            </span>
            <time className="cross-bundle-time" dateTime={bundle.latest_at}>{primaryTimeStr}</time>
          </div>
          <div className="cross-bundle-summary">↳ {summaryLine(bundle)}</div>
          <div className="cross-bundle-actors">{actorsLabel}</div>
        </div>
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
