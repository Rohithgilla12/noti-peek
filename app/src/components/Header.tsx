import { useAppStore, useUnreadCount } from '../store';
import type { Provider } from '../lib/types';

export function Header() {
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const markAllAsRead = useAppStore((state) => state.markAllAsRead);
  const isLoading = useAppStore((state) => state.isLoading);
  const unreadCount = useUnreadCount();

  const sources: Array<{ value: Provider | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'github', label: 'GitHub' },
    { value: 'linear', label: 'Linear' },
  ];

  return (
    <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchNotifications()}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Refresh"
          >
            <span className={isLoading ? 'animate-spin inline-block' : ''}>🔄</span>
          </button>
          <button
            onClick={() => markAllAsRead()}
            disabled={unreadCount === 0}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Mark all as read"
          >
            ✓
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {sources.map((source) => (
            <button
              key={source.value}
              onClick={() => setFilter({ source: source.value })}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter.source === source.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {source.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFilter({ unreadOnly: !filter.unreadOnly })}
          className={`ml-auto px-3 py-1 text-xs rounded-full transition-colors ${
            filter.unreadOnly
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          Unread only
        </button>
      </div>
    </header>
  );
}
