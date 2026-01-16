import { useState, useEffect } from 'react';
import { useAppStore, useUnreadCount } from '../store';
import { useTheme, themes } from '../context/theme';

interface StatusBarProps {
  onOpenSettings: () => void;
}

function formatLastSync(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function GitHubIcon({ connected }: { connected: boolean }) {
  return (
    <svg
      className="w-3.5 h-3.5"
      style={{ color: connected ? 'var(--github)' : 'var(--text-tertiary)' }}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinearIcon({ connected }: { connected: boolean }) {
  return (
    <svg
      className="w-3.5 h-3.5"
      style={{ color: connected ? 'var(--linear)' : 'var(--text-tertiary)' }}
      fill="currentColor"
      viewBox="0 0 100 100"
    >
      <path d="M1.225 61.523c-.222-.949.908-1.546 1.597-.857l36.512 36.512c.69.69.092 1.82-.857 1.597-18.425-4.323-32.93-18.827-37.252-37.252ZM.002 46.889a.99.99 0 0 0 .29.76L52.35 99.71c.201.2.478.307.76.29 2.37-.149 4.695-.46 6.963-.927.765-.157 1.03-1.096.478-1.648L2.576 39.448c-.552-.551-1.491-.286-1.648.479a50.067 50.067 0 0 0-.926 6.962ZM4.21 29.705a.988.988 0 0 0 .208 1.1l64.776 64.776c.289.29.726.375 1.1.208a49.908 49.908 0 0 0 5.185-2.684.981.981 0 0 0 .183-1.54L8.436 24.336a.981.981 0 0 0-1.541.183 49.896 49.896 0 0 0-2.684 5.185Zm8.448-11.631a.986.986 0 0 1-.045-1.354C21.78 6.46 35.111 0 49.952 0 77.592 0 100 22.407 100 50.048c0 14.84-6.46 28.172-16.72 37.338a.986.986 0 0 1-1.354-.045L12.659 18.074Z" />
    </svg>
  );
}

function SyncIcon({ syncing }: { syncing: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

export function StatusBar({ onOpenSettings }: StatusBarProps) {
  const connections = useAppStore((state) => state.connections);
  const isLoading = useAppStore((state) => state.isLoading);
  const error = useAppStore((state) => state.error);
  const lastSyncTime = useAppStore((state) => state.lastSyncTime);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const notifications = useAppStore((state) => state.notifications);
  const unreadCount = useUnreadCount();
  const { theme } = useTheme();

  const [lastSyncDisplay, setLastSyncDisplay] = useState(formatLastSync(lastSyncTime));

  const isGitHubConnected = connections.some((c) => c.provider === 'github');
  const isLinearConnected = connections.some((c) => c.provider === 'linear');
  const connectedCount = connections.length;
  const currentTheme = themes.find((t) => t.id === theme);

  useEffect(() => {
    setLastSyncDisplay(formatLastSync(lastSyncTime));
    const interval = setInterval(() => {
      setLastSyncDisplay(formatLastSync(lastSyncTime));
    }, 10000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  return (
    <div className="h-6 flex items-center justify-between px-2 bg-[var(--bg-surface)] border-t border-[var(--border-muted)] text-[length:var(--text-xs)] select-none">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[var(--bg-highlight)] transition-colors"
            title={isGitHubConnected ? 'GitHub connected' : 'GitHub not connected'}
          >
            <GitHubIcon connected={isGitHubConnected} />
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[var(--bg-highlight)] transition-colors"
            title={isLinearConnected ? 'Linear connected' : 'Linear not connected'}
          >
            <LinearIcon connected={isLinearConnected} />
          </button>
        </div>

        {/* Error indicator */}
        {error && (
          <div
            className="flex items-center gap-1 text-[var(--error)] cursor-help"
            title={error}
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="max-w-[120px] truncate">Error</span>
          </div>
        )}

        {/* Connected count */}
        {connectedCount > 0 && !error && (
          <span className="text-[var(--text-tertiary)]">
            {connectedCount} source{connectedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification count */}
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span>
            {unreadCount > 0 ? (
              <span className="text-[var(--accent)]">{unreadCount} unread</span>
            ) : (
              <span>{notifications.length} total</span>
            )}
          </span>
        </div>

        {/* Sync status */}
        <button
          onClick={() => fetchNotifications()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[var(--bg-highlight)] text-[var(--text-secondary)] transition-colors disabled:opacity-50"
          title={`Last sync: ${lastSyncDisplay}\nClick to refresh`}
        >
          <SyncIcon syncing={isLoading} />
          <span>{lastSyncDisplay}</span>
        </button>

        {/* Theme indicator */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[var(--bg-highlight)] transition-colors"
          title={`Theme: ${currentTheme?.name}`}
        >
          <div
            className="w-2.5 h-2.5 rounded-full border border-[var(--border-default)]"
            style={{ background: currentTheme?.preview }}
          />
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex items-center px-1 py-0.5 rounded hover:bg-[var(--bg-highlight)] text-[var(--text-secondary)] transition-colors"
          title="Settings (Cmd+,)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
