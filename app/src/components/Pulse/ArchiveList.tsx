import { useMemo } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Notification } from '../../lib/types';
import { NotificationRow } from '../shared/NotificationRow';
import { startOfDay, dayLabel } from '../../lib/days';
import { useAppStore } from '../../store';
import { usePulseStore } from '../../store/pulse';

interface Props {
  rows: Notification[];
  hasMore: boolean;
  onLoadMore: () => void;
  emptyHint: string;
}

export function ArchiveList({ rows, hasMore, onLoadMore, emptyHint }: Props) {
  const markAsRead = useAppStore((s) => s.markAsRead);
  const selectedArchiveId = usePulseStore((s) => s.selectedArchiveId);
  const expandedArchiveId = usePulseStore((s) => s.expandedArchiveId);
  const selectArchive = usePulseStore((s) => s.selectArchive);
  const toggleExpand = usePulseStore((s) => s.toggleExpand);

  const grouped = useMemo(() => {
    const m = new Map<number, Notification[]>();
    for (const n of rows) {
      const key = startOfDay(n.updatedAt);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [rows]);

  if (rows.length === 0) {
    return <div className="pulse-archive-empty">{emptyHint}</div>;
  }

  return (
    <div className="pulse-archive">
      {grouped.map(([day, items]) => {
        const { label, sub } = dayLabel(day);
        return (
          <section key={day} className="day-group">
            <h5>
              {label}
              <span className="subtle">
                {sub} · {items.length} event{items.length === 1 ? '' : 's'}
              </span>
            </h5>
            {items.map((n) => {
              const expanded = expandedArchiveId === n.id;
              return (
                <div key={n.id} className={`pulse-archive-item${expanded ? ' expanded' : ''}`}>
                  <NotificationRow
                    n={n}
                    selected={selectedArchiveId === n.id}
                    onSelect={() => {
                      selectArchive(n.id);
                      toggleExpand(n.id);
                    }}
                    onOpen={() => {
                      void openUrl(n.url).catch((err) => console.error('open url failed:', err));
                      if (n.unread) markAsRead(n.id);
                    }}
                  />
                  {expanded && (
                    <div className="pulse-archive-body">
                      {n.body && <p>{n.body}</p>}
                      <button
                        type="button"
                        className="pulse-archive-open"
                        onClick={() => {
                          void openUrl(n.url).catch((err) => console.error('open url failed:', err));
                          if (n.unread) markAsRead(n.id);
                        }}
                      >
                        open ↗
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      {hasMore && (
        <button type="button" className="pulse-archive-more" onClick={onLoadMore}>
          load more
        </button>
      )}
    </div>
  );
}
