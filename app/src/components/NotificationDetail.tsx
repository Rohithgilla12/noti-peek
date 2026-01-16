import { openUrl } from '@tauri-apps/plugin-opener';
import type { Notification } from '../lib/types';
import { useAppStore } from '../store';

interface NotificationDetailProps {
  notification: Notification;
  onClose: () => void;
}

function SourceIcon({ source }: { source: string }) {
  const colorVar = `var(--${source})`;

  switch (source) {
    case 'github':
      return (
        <svg className="w-5 h-5" style={{ color: colorVar }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      );
    case 'linear':
      return (
        <svg className="w-5 h-5" style={{ color: colorVar }} fill="currentColor" viewBox="0 0 100 100">
          <path d="M1.225 61.523c-.222-.949.908-1.546 1.597-.857l36.512 36.512c.69.69.092 1.82-.857 1.597-18.425-4.323-32.93-18.827-37.252-37.252ZM.002 46.889a.99.99 0 0 0 .29.76L52.35 99.71c.201.2.478.307.76.29 2.37-.149 4.695-.46 6.963-.927.765-.157 1.03-1.096.478-1.648L2.576 39.448c-.552-.551-1.491-.286-1.648.479a50.067 50.067 0 0 0-.926 6.962ZM4.21 29.705a.988.988 0 0 0 .208 1.1l64.776 64.776c.289.29.726.375 1.1.208a49.908 49.908 0 0 0 5.185-2.684.981.981 0 0 0 .183-1.54L8.436 24.336a.981.981 0 0 0-1.541.183 49.896 49.896 0 0 0-2.684 5.185Zm8.448-11.631a.986.986 0 0 1-.045-1.354C21.78 6.46 35.111 0 49.952 0 77.592 0 100 22.407 100 50.048c0 14.84-6.46 28.172-16.72 37.338a.986.986 0 0 1-1.354-.045L12.659 18.074Z"/>
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}

function TypeBadge({ type }: { type: string }) {
  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'pull_request':
        return 'bg-[var(--success)] bg-opacity-20 text-[var(--success)]';
      case 'issue':
        return 'bg-[var(--info)] bg-opacity-20 text-[var(--info)]';
      case 'comment':
        return 'bg-[var(--accent)] bg-opacity-20 text-[var(--accent)]';
      case 'release':
        return 'bg-[var(--warning)] bg-opacity-20 text-[var(--warning)]';
      case 'assigned':
        return 'bg-[var(--error)] bg-opacity-20 text-[var(--error)]';
      case 'mentioned':
        return 'bg-purple-500 bg-opacity-20 text-purple-400';
      default:
        return 'bg-[var(--bg-overlay)] text-[var(--text-secondary)]';
    }
  };

  return (
    <span className={`px-2 py-1 text-[length:var(--text-xs)] rounded-[var(--radius-sm)] font-medium ${getBadgeColor(type)}`}>
      {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </span>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationDetail({ notification, onClose }: NotificationDetailProps) {
  const markAsRead = useAppStore((state) => state.markAsRead);

  const handleOpenInBrowser = async () => {
    await openUrl(notification.url);
    if (notification.unread) {
      await markAsRead(notification.id);
    }
  };

  const handleMarkAsRead = async () => {
    if (notification.unread) {
      await markAsRead(notification.id);
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-[var(--border-muted)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--border-muted)]">
        <h2 className="text-[length:var(--text-base)] font-semibold text-[var(--text-primary)]">
          Notification Details
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 rounded-[var(--radius-sm)] hover:bg-[var(--bg-overlay)]"
          title="Close (Esc)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-overlay)] flex-shrink-0">
            <SourceIcon source={notification.source} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[length:var(--text-xs)] text-[var(--text-secondary)] font-medium">
                {notification.source.toUpperCase()}
              </span>
              <TypeBadge type={notification.type} />
              {notification.unread && (
                <span className="px-2 py-0.5 text-[length:var(--text-xs)] bg-[var(--unread)] bg-opacity-20 text-[var(--unread)] rounded-full font-medium">
                  Unread
                </span>
              )}
            </div>
            <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)] truncate">
              {notification.repo || notification.project}
            </p>
          </div>
        </div>

        <h3 className="text-[length:var(--text-lg)] font-semibold text-[var(--text-primary)] mb-3 leading-snug">
          {notification.title}
        </h3>

        {notification.body && (
          <div className="mb-4 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)] border border-[var(--border-muted)]">
            <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)] whitespace-pre-wrap break-words">
              {notification.body}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 p-3 bg-[var(--bg-base)] rounded-[var(--radius-md)]">
          {notification.author.avatar && (
            <img
              src={notification.author.avatar}
              alt={notification.author.name}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[length:var(--text-xs)] text-[var(--text-tertiary)]">
              Author
            </p>
            <p className="text-[length:var(--text-sm)] text-[var(--text-primary)] font-medium">
              {notification.author.name}
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between p-2">
            <span className="text-[length:var(--text-xs)] text-[var(--text-tertiary)]">
              Created
            </span>
            <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
              {formatDate(notification.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between p-2">
            <span className="text-[length:var(--text-xs)] text-[var(--text-tertiary)]">
              Updated
            </span>
            <span className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">
              {formatDate(notification.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-[var(--border-muted)] space-y-2">
        <button
          onClick={handleOpenInBrowser}
          className="w-full px-4 py-2 text-[length:var(--text-sm)] font-medium bg-[var(--accent)] text-[var(--bg-base)] rounded-[var(--radius-md)] hover:bg-[var(--accent-hover)] transition-colors duration-150 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open in Browser
        </button>
        {notification.unread && (
          <button
            onClick={handleMarkAsRead}
            className="w-full px-4 py-2 text-[length:var(--text-sm)] font-medium bg-[var(--bg-overlay)] text-[var(--text-primary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-highlight)] transition-colors duration-150 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Mark as Read
          </button>
        )}
      </div>
    </div>
  );
}
