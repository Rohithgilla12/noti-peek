import { useEffect, useState, useCallback } from 'react';
import { load } from '@tauri-apps/plugin-store';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { useAppStore } from './store';
import { api } from './lib/api';
import { TopNav } from './components/TopNav';
import { DayStream } from './components/DayStream';
import { DetailPane } from './components/DetailPane';
import { Footer } from './components/Footer';
import { Settings } from './components/Settings';
import { Pulse } from './components/Pulse/Pulse';
import { useUpdater } from './hooks/useUpdater';

const STORE_KEY = 'auth';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setAuth = useAppStore((s) => s.setAuth);
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const fetchConnections = useAppStore((s) => s.fetchConnections);
  const initializeFromCache = useAppStore((s) => s.initializeFromCache);
  const refreshInterval = useAppStore((s) => s.refreshInterval);
  const selectedId = useAppStore((s) => s.selectedNotificationId);
  const setSelectedId = useAppStore((s) => s.setSelectedNotification);
  const notifications = useAppStore((s) => s.notifications);
  const markAsRead = useAppStore((s) => s.markAsRead);
  const markAllAsRead = useAppStore((s) => s.markAllAsRead);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const selected = notifications.find((n) => n.id === selectedId) ?? null;

  const { status: updaterStatus, installNow, checkNow: checkForUpdatesNow } =
    useUpdater({ checkOnMount: true });

  useEffect(() => {
    const id = setInterval(() => void checkForUpdatesNow(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [checkForUpdatesNow]);

  const initialize = useCallback(async () => {
    try {
      await initializeFromCache();

      const store = await load('config.json');

      const savedTab = await store.get<'inbox' | 'pulse'>('activeTab');
      if (savedTab === 'inbox' || savedTab === 'pulse') {
        useAppStore.getState().setActiveTab(savedTab);
      }

      api.setOnUnauthorized(async () => {
        try {
          const { id, deviceToken } = await api.register();
          api.setDeviceToken(deviceToken);
          setAuth(deviceToken, id);
          await store.set(STORE_KEY, { deviceToken, userId: id });
          await store.save();
          return deviceToken;
        } catch (err) {
          console.error('Auto re-register failed:', err);
          return null;
        }
      });

      const authData = await store.get<{ deviceToken: string; userId: string }>(STORE_KEY);

      if (authData?.deviceToken) {
        api.setDeviceToken(authData.deviceToken);
        try {
          const { valid, userId } = await api.verify();
          if (valid) {
            setAuth(authData.deviceToken, userId);
            return;
          }
        } catch {
          /* token invalid — fall through to register */
        }
      }

      const { id, deviceToken } = await api.register();
      api.setDeviceToken(deviceToken);
      setAuth(deviceToken, id);
      await store.set(STORE_KEY, { deviceToken, userId: id });
      await store.save();
    } catch (err) {
      console.error('Failed to initialize:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [setAuth, initializeFromCache]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    void load('config.json').then((s) => {
      void s.set('activeTab', activeTab).then(() => s.save());
    });
  }, [activeTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConnections();
    fetchNotifications();
    const id = setInterval(() => fetchNotifications(), refreshInterval);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchConnections, fetchNotifications, refreshInterval]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;

      // ⌘R → refresh. Plain `r` also works when not typing.
      if (e.key === 'r' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        fetchNotifications();
      }
      // ⌘, → preferences
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings(true);
      }
      // ⌘W → hide window (stay running in tray)
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void getCurrentWindow().hide();
      }
      if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (selectedId) setSelectedId(null);
      }
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
        setActiveTab('inbox');
      }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
        setActiveTab('pulse');
      }
      if (e.key === 'Enter' && selected) {
        void openUrl(selected.url).catch((err) => console.error('open url failed:', err));
        if (selected.unread) markAsRead(selected.id);
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('comment-textarea')?.focus();
      }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        (document.querySelector('button[data-action="merge"]') as HTMLButtonElement)?.click();
      }
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.shiftKey && selected) {
        e.preventDefault();
        if (selected.unread) markAsRead(selected.id);
      }
      if (e.key === 'E' && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        void markAllAsRead();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchNotifications, showSettings, selectedId, selected, setSelectedId, markAsRead, markAllAsRead, setActiveTab]);

  const setFilter = useAppStore((s) => s.setFilter);
  const filter = useAppStore((s) => s.filter);

  // Native app menu + tray right-click menu both dispatch these events
  // from Rust so the frontend doesn't have to know where they came from.
  useEffect(() => {
    const unlisteners = [
      listen('open-preferences', () => setShowSettings(true)),
      listen('menu-refresh', () => fetchNotifications()),
      listen('menu-toggle-unread', () =>
        setFilter({ unreadOnly: !filter.unreadOnly }),
      ),
    ];
    return () => {
      for (const p of unlisteners) void p.then((fn) => fn());
    };
  }, [fetchNotifications, setFilter, filter.unreadOnly]);

  if (isInitializing) {
    return (
      <div className="app-shell">
        <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{
              width: 18, height: 18, border: '1.5px solid var(--line)',
              borderBottomColor: 'var(--accent)', borderRadius: '50%',
              margin: '0 auto 14px',
            }} />
            <p className="small-caps">starting up…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopNav onOpenSettings={() => setShowSettings(true)} />
      <UpdateBanner status={updaterStatus} onInstall={() => void installNow()} />
      <main className="app-main">
        {activeTab === 'inbox' ? (
          <>
            <section className="stream-col">
              <DayStream />
            </section>
            <section className="detail-col">
              <DetailPane notification={selected} />
            </section>
          </>
        ) : (
          <section className="pulse-col">
            <Pulse />
          </section>
        )}
      </main>
      <Footer />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function UpdateBanner({
  status,
  onInstall,
}: {
  status: ReturnType<typeof useUpdater>['status'];
  onInstall: () => void;
}) {
  if (status.kind === 'available') {
    return (
      <div className="update-banner" role="status">
        <span>
          update available — <strong>{status.update.version}</strong>
        </span>
        <button onClick={onInstall} className="update-banner-btn">install &amp; restart</button>
      </div>
    );
  }
  if (status.kind === 'downloading') {
    return (
      <div className="update-banner">
        downloading update{status.percent !== null ? `… ${status.percent}%` : '…'}
      </div>
    );
  }
  if (status.kind === 'ready') {
    return <div className="update-banner">update installed — relaunching…</div>;
  }
  return null;
}

export default App;
