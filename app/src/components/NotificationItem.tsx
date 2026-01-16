import { openUrl } from '@tauri-apps/plugin-opener';
import type { Notification } from '../lib/types';
import { useAppStore } from '../store';

interface NotificationItemProps {
  notification: Notification;
}

function getSourceIcon(source: string): string {
  switch (source) {
    case 'github':
      return '🐙';
    case 'linear':
      return '📐';
    case 'jira':
      return '🎫';
    case 'bitbucket':
      return '🪣';
    default:
      return '📬';
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'pull_request':
      return '🔀';
    case 'issue':
      return '🐛';
    case 'comment':
      return '💬';
    case 'release':
      return '🚀';
    case 'assigned':
      return '👤';
    case 'mentioned':
      return '📣';
    case 'status_change':
      return '🔄';
    default:
      return '📌';
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const markAsRead = useAppStore((state) => state.markAsRead);

  const handleClick = async () => {
    await openUrl(notification.url);
    if (notification.unread) {
      await markAsRead(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        notification.unread ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-xl">
          {getSourceIcon(notification.source)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{getTypeIcon(notification.type)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {notification.repo || notification.project}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
              {formatTimeAgo(notification.updatedAt)}
            </span>
          </div>
          <h3 className={`text-sm leading-tight ${notification.unread ? 'font-semibold' : 'font-normal'} text-gray-900 dark:text-gray-100`}>
            {notification.title}
          </h3>
          {notification.body && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {notification.body}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {notification.author.avatar && (
              <img
                src={notification.author.avatar}
                alt={notification.author.name}
                className="w-4 h-4 rounded-full"
              />
            )}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {notification.author.name}
            </span>
          </div>
        </div>
        {notification.unread && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
