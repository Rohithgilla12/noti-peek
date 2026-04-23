import { useMemo, useEffect } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore, useFilteredNotifications, useUnreadCount } from '../store';
import type { Notification, Provider, NotificationRow } from '../lib/types';
import { startOfDay, dayLabel } from '../lib/days';
import { RowDispatcher } from './shared/RowDispatcher';
import { trackCrossBundleRendered } from '../lib/telemetry-events';

type FilterSource = Provider | 'all';

const SOURCES: Array<{ value: FilterSource; label: string; experimental?: boolean }> = [
  { value: 'all', label: 'all' },
  { value: 'github', label: 'github' },
  { value: 'linear', label: 'linear' },
  { value: 'jira', label: 'jira', experimental: true },
  { value: 'bitbucket', label: 'bitbucket', experimental: true },
];

const enableExperimentalProviders =
  import.meta.env.VITE_ENABLE_EXPERIMENTAL_PROVIDERS === 'true';

const rowLatestMs = (r: NotificationRow): number => {
  if (r.kind === 'single') return new Date(r.notification.updatedAt).getTime();
  return new Date(r.bundle.latest_at).getTime();
};

export function DayStream() {
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);
  const selectedId = useAppStore((s) => s.selectedNotificationId);
  const setSelectedId = useAppStore((s) => s.setSelectedNotification);
  const markAsRead = useAppStore((s) => s.markAsRead);
  const markAllAsRead = useAppStore((s) => s.markAllAsRead);
  const connections = useAppStore((s) => s.connections);

  const rows = useAppStore((s) => s.rows);
  const expandedIds = useAppStore((s) => s.expandedBundleIds);
  const toggleExpanded = useAppStore((s) => s.toggleExpanded);
  const markCrossBundleRead = useAppStore((s) => s.markCrossBundleRead);

  const notifications = useFilteredNotifications();
  const unread = useUnreadCount();

  const effectiveRows: NotificationRow[] = useMemo(() => {
    if (rows.length > 0) return rows;
    return notifications.map((n) => ({ kind: 'single' as const, notification: n }));
  }, [rows, notifications]);

  const filteredRows: NotificationRow[] = useMemo(() => {
    if (filter.source === 'all') return effectiveRows;
    return effectiveRows.filter((r) => {
      if (r.kind === 'single') return r.notification.source === filter.source;
      return r.bundle.children.some((c: Notification) => c.source === filter.source);
    });
  }, [effectiveRows, filter.source]);

  const visibleRows: NotificationRow[] = useMemo(() => {
    if (!filter.unreadOnly) return filteredRows;
    return filteredRows.filter((r) => {
      if (r.kind === 'single') return r.notification.unread;
      return r.bundle.unread_count > 0;
    });
  }, [filteredRows, filter.unreadOnly]);

  const grouped = useMemo(() => {
    const m = new Map<number, NotificationRow[]>();
    for (const r of visibleRows) {
      const ms = rowLatestMs(r);
      const key = startOfDay(new Date(ms).toISOString());
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [visibleRows]);

  const flatIds = useMemo((): string[] => {
    const out: string[] = [];
    for (const r of visibleRows) {
      if (r.kind === 'single') {
        out.push(r.notification.id);
      } else if (expandedIds.has(r.bundle.id)) {
        for (const c of r.bundle.children) out.push(c.id);
      }
    }
    return out;
  }, [visibleRows, expandedIds]);

  useEffect(() => {
    const count = rows.filter((r) => r.kind === 'cross_bundle').length;
    if (count > 0) trackCrossBundleRendered(count);
  }, [rows]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (flatIds.length === 0) return;
      const idx = selectedId ? flatIds.indexOf(selectedId) : -1;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(flatIds.length - 1, idx + 1);
        setSelectedId(flatIds[next] ?? null);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, idx - 1);
        setSelectedId(flatIds[prev] ?? null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flatIds, selectedId, setSelectedId]);

  return (
    <>
      <div className="stream-head">
        <div className="filter-chips" role="tablist">
          {SOURCES
            .filter((s) => !s.experimental || enableExperimentalProviders)
            .filter((s) => s.value === 'all' || connections.some(c => c.provider === s.value))
            .map((s) => (
              <button
                key={s.value}
                role="tab"
                aria-current={filter.source === s.value}
                onClick={() => setFilter({ source: s.value })}
                type="button"
              >
                {s.label}
              </button>
            ))}
        </div>
        <div className="stream-actions">
          <button
            className="mark-all-read"
            onClick={() => void markAllAsRead()}
            type="button"
            title="Mark all as read (Shift+E)"
          >
            mark all read
          </button>
          <button
            className="unread-toggle"
            aria-pressed={filter.unreadOnly}
            onClick={() => setFilter({ unreadOnly: !filter.unreadOnly })}
            type="button"
          >
            unread only
          </button>
        </div>
        <div className="count">
          <b>{String(unread).padStart(2, '0')}</b> unread ·{' '}
          <span>{notifications.length}</span> total
        </div>
      </div>

      {error && (
        <div className="error-banner" role="status">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style={{ marginTop: 1 }}>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="stream">
        {isLoading && notifications.length === 0 && (
          <div className="empty-state">loading…</div>
        )}

        {!isLoading && visibleRows.length === 0 && !error && (
          <div className="empty-state">
            you're all caught up
          </div>
        )}

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
              {items.map((row) => {
                const rowKey = row.kind === 'single' ? row.notification.id : row.bundle.id;
                return (
                  <RowDispatcher
                    key={rowKey}
                    row={row}
                    selectedId={selectedId}
                    expandedIds={expandedIds}
                    onSelect={setSelectedId}
                    onOpen={(url, id) => {
                      void openUrl(url).catch((err) => console.error('open url failed:', err));
                      const target = notifications.find((n) => n.id === id);
                      if (target?.unread) markAsRead(id);
                    }}
                    onToggleExpand={toggleExpanded}
                    onMarkBundleRead={row.kind === 'cross_bundle' ? markCrossBundleRead : undefined}
                  />
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
