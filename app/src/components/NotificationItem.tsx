import { openUrl } from '@tauri-apps/plugin-opener';
import type { Notification } from '../lib/types';
import { useAppStore } from '../store';

interface NotificationItemProps {
  notification: Notification;
}

function SourceIcon({ source }: { source: string }) {
  const colorVar = `var(--${source})`;

  switch (source) {
    case 'github':
      return (
        <svg className="w-4 h-4" style={{ color: colorVar }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    case 'linear':
      return (
        <svg className="w-4 h-4" style={{ color: colorVar }} fill="currentColor" viewBox="0 0 100 100">
          <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.00567075.5765.07145765.877l5.11115015 21.8135c.222.9485.90744 1.5459 1.59634.857l23.0566-23.0566c.2467-.2467.2467-.6466 0-.8934L12.0753 28.7255c-.2467-.2467-.6466-.2467-.8934 0L.304014 39.6033C.105431 39.8019.000881 40.0696.00189 40.3483l-.00000135 6.5765v-.0357ZM.00000135 34.3891v.0357c-.0106912-.3399.084019-.6705.277611-.9561l-.277611.9204ZM12.6217 23.0306 24.3696 11.2827c.2378-.2378.6244-.2418.8666-.0085 9.5019 9.1573 14.6017 21.8633 13.5329 35.4343-.1108 1.407-1.7272 2.0379-2.7302 1.0349L12.6217 24.327c-.2467-.2467-.2467-.6467 0-.8934l-.0001-.0001.0001-.403ZM19.2727 4.34818c.4088-.6282 1.2853-.68276 1.7595-.15803C34.0423 19.0282 47.9748 32.6396 61.8341 47.4296c.6244.6666.0705 1.7632-.8507 1.6822l-.0072-.0006c-11.7847-1.0398-22.3946-6.3061-29.8783-14.5124l-.0005-.0006C22.6222 25.4629 17.3569 14.86 19.2727 4.34818Z"/>
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}

function TypeIcon({ type }: { type: string }) {
  const className = "w-3.5 h-3.5 text-[var(--text-tertiary)]";

  switch (type) {
    case 'pull_request':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'issue':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case 'comment':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'release':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case 'assigned':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'mentioned':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      );
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
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
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
      className={`
        group flex items-start gap-3
        px-3 py-2.5
        bg-[var(--bg-surface)]
        hover:bg-[var(--bg-highlight)]
        border-b border-[var(--border-muted)]
        cursor-pointer
        transition-colors duration-150
        notification-enter
        ${notification.unread ? 'bg-[var(--accent-muted)]' : ''}
      `}
    >
      {notification.unread && (
        <div className="w-2 h-2 mt-2 rounded-full bg-[var(--unread)] unread-dot flex-shrink-0" />
      )}

      <div className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-overlay)] flex-shrink-0">
        <SourceIcon source={notification.source} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <TypeIcon type={notification.type} />
          <span className="text-[length:var(--text-xs)] text-[var(--text-secondary)] truncate">
            {notification.repo || notification.project}
          </span>
          <span className="text-[length:var(--text-xs)] text-[var(--text-tertiary)] ml-auto flex-shrink-0">
            {formatTimeAgo(notification.updatedAt)}
          </span>
        </div>
        <p
          className={`
            text-[length:var(--text-sm)]
            text-[var(--text-primary)]
            truncate
            ${notification.unread ? 'font-medium' : 'font-normal'}
          `}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-[length:var(--text-xs)] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
            {notification.body}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {notification.author.avatar && (
            <img
              src={notification.author.avatar}
              alt={notification.author.name}
              className="w-4 h-4 rounded-full"
            />
          )}
          <span className="text-[length:var(--text-xs)] text-[var(--text-tertiary)]">
            {notification.author.name}
          </span>
        </div>
      </div>
    </div>
  );
}
