import { useAppStore, useUnreadCount } from '../store';

interface Props {
  onOpenSettings: () => void;
}

/**
 * macOS-style toolbar: inset traffic lights live in the left gutter,
 * the bar is drag-region everywhere except the action buttons. Brand
 * anchors the centre-left; refresh + settings sit on the right.
 */
export function TopNav({ onOpenSettings }: Props) {
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const isSyncing = useAppStore((s) => s.isLoading || s.isSyncing);
  const unread = useUnreadCount();

  return (
    <header className="topnav" data-tauri-drag-region>
      <div className="topnav-gutter" aria-hidden="true" />
      <div className="topnav-brand">
        <span className="topnav-wordmark">
          noti&#8209;peek<em>.</em>
        </span>
        {unread > 0 && (
          <span className="topnav-unread" aria-label={`${unread} unread`}>
            {String(unread).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="topnav-actions">
        <button
          onClick={() => fetchNotifications()}
          disabled={isSyncing}
          title="Refresh (⌘R)"
          aria-label="Refresh"
          type="button"
        >
          <svg
            className={isSyncing ? 'spinner' : undefined}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button onClick={onOpenSettings} title="Settings (⌘,)" aria-label="Settings" type="button">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
