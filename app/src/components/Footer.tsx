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
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const refreshInterval = useAppStore((s) => s.refreshInterval);

  const fresh = lastSync !== null && Date.now() - lastSync.getTime() < 5 * 60 * 1000;

  const [label, setLabel] = useState(formatLastSync(lastSync));
  useEffect(() => {
    setLabel(formatLastSync(lastSync));
    const id = setInterval(() => setLabel(formatLastSync(lastSync)), 10_000);
    return () => clearInterval(id);
  }, [lastSync]);

  const refreshSeconds = Math.round(refreshInterval / 1000);

  return (
    <footer className="footer">
      <div className="left">
        <span className="footer-presence" data-fresh={fresh || undefined} aria-hidden />
        <span>Refreshed {label}</span>
        <span className="sep">·</span>
        <span>Auto · Every {refreshSeconds}s</span>
      </div>
      <div className="right">
        {isOffline && <span style={{ color: 'var(--accent)' }}>offline</span>}
        <button onClick={() => fetchNotifications()} disabled={isSyncing} type="button">
          {isSyncing ? 'syncing…' : 'refresh'}
        </button>
      </div>
    </footer>
  );
}
