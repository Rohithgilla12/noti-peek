import { useMemo, useEffect } from 'react';
import { useAppStore, useFilteredNotifications, useUnreadCount } from '../store';
import type { Notification, Provider } from '../lib/types';

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

function startOfDay(iso: string): number {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(ts: number): { label: string; sub: string } {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((todayStart - ts) / 86_400_000);
  const d = new Date(ts);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();

  if (diffDays === 0) return { label: 'Today', sub: `${weekday} · ${date}` };
  if (diffDays === 1) return { label: 'Yesterday', sub: `${weekday} · ${date}` };
  if (diffDays < 7) return { label: weekday, sub: date };
  return { label: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }), sub: date };
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (d.getTime() >= todayStart.getTime()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const y = todayStart.getTime() - 86_400_000;
  if (d.getTime() >= y) return 'yd';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}

export function DayStream() {
  const filter = useAppStore((s) => s.filter);
  const setFilter = useAppStore((s) => s.setFilter);
  const isLoading = useAppStore((s) => s.isLoading);
  const error = useAppStore((s) => s.error);
  const selectedId = useAppStore((s) => s.selectedNotificationId);
  const setSelectedId = useAppStore((s) => s.setSelectedNotification);
  const markAsRead = useAppStore((s) => s.markAsRead);

  const notifications = useFilteredNotifications();
  const unread = useUnreadCount();

  const grouped = useMemo(() => {
    const m = new Map<number, Notification[]>();
    for (const n of notifications) {
      const key = startOfDay(n.updatedAt);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(n);
    }
    return Array.from(m.entries()).sort((a, b) => b[0] - a[0]);
  }, [notifications]);

  // Keyboard j/k navigation through the flat ordered list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (notifications.length === 0) return;

      const idx = selectedId
        ? notifications.findIndex((n) => n.id === selectedId)
        : -1;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(notifications.length - 1, idx + 1);
        setSelectedId(notifications[next]?.id ?? null);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(0, idx - 1);
        setSelectedId(notifications[prev]?.id ?? null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notifications, selectedId, setSelectedId]);

  return (
    <>
      <div className="stream-head">
        <div className="filter-chips" role="tablist">
          {SOURCES
            .filter((s) => !s.experimental || enableExperimentalProviders)
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
        <div></div>
        <button
          className="unread-toggle"
          aria-pressed={filter.unreadOnly}
          onClick={() => setFilter({ unreadOnly: !filter.unreadOnly })}
          type="button"
        >
          unread only
        </button>
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

        {!isLoading && notifications.length === 0 && !error && (
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
              {items.map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  selected={n.id === selectedId}
                  onSelect={() => setSelectedId(n.id)}
                  onOpen={() => {
                    window.open(n.url, '_blank');
                    if (n.unread) markAsRead(n.id);
                  }}
                />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

function Row({
  n,
  selected,
  onSelect,
  onOpen,
}: {
  n: Notification;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const ref = n.repo ?? n.project ?? '';
  return (
    <button
      className={`day-row ${n.unread ? 'unread' : 'read'}`}
      data-source={n.source}
      aria-current={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      type="button"
    >
      <span className="marker" aria-hidden="true"></span>
      <span className="src">{n.source}</span>
      <span className="title">
        {ref && <span className="ref">{ref}</span>}
        <span>{n.title}</span>
        {n.author?.name && <span className="note">· {n.author.name}</span>}
      </span>
      <span className="time">{timeLabel(n.updatedAt)}</span>
    </button>
  );
}
