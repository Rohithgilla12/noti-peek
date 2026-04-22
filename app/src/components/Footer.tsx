import { useEffect, useState } from 'react';
import { useAppStore } from '../store';

function formatLastSync(d: Date | null): string {
  if (!d) return 'never';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Footer() {
  const lastSync = useAppStore((s) => s.lastSyncTime);
  const isSyncing = useAppStore((s) => s.isLoading || s.isSyncing);
  const isOffline = useAppStore((s) => s.isOffline);
  const connections = useAppStore((s) => s.connections);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);

  const [label, setLabel] = useState(formatLastSync(lastSync));
  useEffect(() => {
    setLabel(formatLastSync(lastSync));
    const id = setInterval(() => setLabel(formatLastSync(lastSync)), 10_000);
    return () => clearInterval(id);
  }, [lastSync]);

  return (
    <footer className="footer">
      <div className="left">
        <span>
          <span className="dot">●</span>{' '}
          {connections.length} source{connections.length === 1 ? '' : 's'} connected
        </span>
        <span className="sep">·</span>
        <span>
          <kbd>J</kbd>/<kbd>K</kbd> move
        </span>
        <span className="sep">·</span>
        <span>
          <kbd>⏎</kbd> open
        </span>
        <span className="sep">·</span>
        <span>
          <kbd>E</kbd> mark read
        </span>
        <span className="sep">·</span>
        <span>
          <kbd>R</kbd> refresh
        </span>
      </div>
      <div className="right">
        {isOffline && <span style={{ color: 'var(--accent)' }}>offline</span>}
        <button onClick={() => fetchNotifications()} disabled={isSyncing} type="button">
          {isSyncing ? 'syncing…' : `synced ${label}`}
        </button>
      </div>
    </footer>
  );
}
