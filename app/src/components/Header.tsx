import { useAppStore, useUnreadCount, useNotificationTypes } from '../store';
import type { Provider } from '../lib/types';

export function Header() {
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const markAllAsRead = useAppStore((state) => state.markAllAsRead);
  const isLoading = useAppStore((state) => state.isLoading);
  const unreadCount = useUnreadCount();
  const notificationTypes = useNotificationTypes();

  const sources: Array<{ value: Provider | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'github', label: 'GitHub' },
    { value: 'linear', label: 'Linear' },
  ];

  return (
    <header className="sticky top-0 z-10 bg-[var(--bg-base)] border-b border-[var(--border-muted)] p-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[length:var(--text-lg)] font-semibold text-[var(--text-primary)]">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-[length:var(--text-xs)] bg-[var(--accent)] text-[var(--bg-base)] rounded-full font-medium scale-in">
              {unreadCount}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications()}
            disabled={isLoading}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-all duration-150 hover:scale-110 active:scale-95"
            title="Refresh (R)"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'spinner' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-all duration-150 hover:scale-110 active:scale-95"
            title="Mark all as read"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 p-1 bg-[var(--bg-surface)] rounded-[var(--radius-md)]">
          {sources.map((source) => (
            <button
              key={source.value}
              onClick={() => setFilter({ source: source.value })}
              className={`px-3 py-1.5 text-[length:var(--text-sm)] rounded-[var(--radius-sm)] transition-all duration-150 ${
                filter.source === source.value
                  ? 'bg-[var(--bg-overlay)] text-[var(--text-primary)] scale-in'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]/50'
              }`}
            >
              {source.label}
            </button>
          ))}
        </div>

        {notificationTypes.length > 0 && (
          <select
            value={filter.type}
            onChange={(e) => setFilter({ type: e.target.value })}
            className="px-3 py-1.5 text-[length:var(--text-sm)] rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-muted)] hover:border-[var(--border-default)] transition-all duration-150 cursor-pointer focus:ring-2 focus:ring-[var(--accent)]/30 outline-none"
          >
            <option value="all">All types</option>
            {notificationTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setFilter({ unreadOnly: !filter.unreadOnly })}
          className={`ml-auto px-3 py-1.5 text-[length:var(--text-sm)] rounded-[var(--radius-md)] transition-all duration-150 active:scale-95 ${
            filter.unreadOnly
              ? 'bg-[var(--accent-muted)] text-[var(--accent)] scale-in'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
          }`}
        >
          Unread only
        </button>
      </div>
    </header>
  );
}
