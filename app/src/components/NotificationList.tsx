import { useAppStore, useFilteredNotifications } from '../store';
import { NotificationItem } from './NotificationItem';

export function NotificationList() {
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);
  const notifications = useFilteredNotifications();

  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-[var(--error)] text-[length:var(--text-sm)]">{error}</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)]">
        <span className="text-4xl mb-4">🎉</span>
        <p className="text-[length:var(--text-sm)]">No notifications</p>
        <p className="text-[length:var(--text-xs)] mt-1 text-[var(--text-tertiary)]">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
