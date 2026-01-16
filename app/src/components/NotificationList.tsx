import { useAppStore, useFilteredNotifications } from '../store';
import { NotificationItem } from './NotificationItem';

function SkeletonNotificationItem() {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 border-b border-[var(--border-muted)]">
      <div className="w-2 h-2 mt-2 rounded-full skeleton flex-shrink-0" />
      <div className="w-8 h-8 rounded-[var(--radius-md)] skeleton flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded skeleton" />
          <div className="h-3 w-24 rounded skeleton" />
          <div className="h-3 w-12 rounded skeleton ml-auto" />
        </div>
        <div className="h-3.5 w-3/4 rounded skeleton" />
        <div className="h-3 w-1/2 rounded skeleton" />
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-4 h-4 rounded-full skeleton" />
          <div className="h-3 w-20 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex-1 overflow-hidden fade-in">
      {[...Array(5)].map((_, i) => (
        <SkeletonNotificationItem key={i} />
      ))}
    </div>
  );
}

export function NotificationList() {
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);
  const notifications = useFilteredNotifications();

  if (isLoading && notifications.length === 0) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-4 text-center fade-in">
        <p className="text-[var(--error)] text-[length:var(--text-sm)]">{error}</p>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-secondary)] fade-in">
        <span className="text-4xl mb-4 scale-in">🎉</span>
        <p className="text-[length:var(--text-sm)]">No notifications</p>
        <p className="text-[length:var(--text-xs)] mt-1 text-[var(--text-tertiary)]">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {notifications.map((notification, index) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          index={index}
        />
      ))}
    </div>
  );
}
