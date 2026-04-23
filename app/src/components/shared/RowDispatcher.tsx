import type { NotificationRow } from '../../lib/types';
import { NotificationRow as SingleRow } from './NotificationRow';
import { BundleItem } from './BundleItem';
import { CrossBundleItem } from './CrossBundleItem';

export interface RowDispatcherProps {
  row: NotificationRow;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onOpen: (url: string, id: string) => void;
  onToggleExpand: (id: string) => void;
  onMarkBundleRead?: (id: string) => void;
}

export function RowDispatcher(props: RowDispatcherProps) {
  const { row, selectedId, expandedIds, onSelect, onOpen, onToggleExpand, onMarkBundleRead } = props;
  if (row.kind === 'single') {
    const n = row.notification;
    return (
      <SingleRow
        n={n}
        selected={n.id === selectedId}
        onSelect={() => onSelect(n.id)}
        onOpen={() => onOpen(n.url, n.id)}
      />
    );
  }
  if (row.kind === 'bundle') {
    return (
      <BundleItem
        bundle={row.bundle}
        expanded={expandedIds.has(row.bundle.id)}
        selectedId={selectedId}
        onToggleExpand={() => onToggleExpand(row.bundle.id)}
        onSelect={onSelect}
        onOpen={onOpen}
      />
    );
  }
  return (
    <CrossBundleItem
      bundle={row.bundle}
      expanded={expandedIds.has(row.bundle.id)}
      selectedId={selectedId}
      onToggleExpand={() => onToggleExpand(row.bundle.id)}
      onSelect={onSelect}
      onOpen={onOpen}
      onMarkBundleRead={onMarkBundleRead ? () => onMarkBundleRead(row.bundle.id) : undefined}
    />
  );
}
