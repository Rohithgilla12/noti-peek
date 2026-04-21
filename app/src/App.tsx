import { useEffect, useState, useCallback } from 'react';
import { load } from '@tauri-apps/plugin-store';
import './App.css';
import { useAppStore } from './store';
import { api } from './lib/api';
import { Header } from './components/Header';
import { NotificationList } from './components/NotificationList';
import { Settings } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { NotificationDetail } from './components/NotificationDetail';
import { useUpdater } from './hooks/useUpdater';

const STORE_KEY = 'auth';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuth = useAppStore((state) => state.setAuth);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const initializeFromCache = useAppStore((state) => state.initializeFromCache);
  const refreshInterval = useAppStore((state) => state.refreshInterval);
  const selectedNotificationId = useAppStore((state) => state.selectedNotificationId);
  const setSelectedNotification = useAppStore((state) => state.setSelectedNotification);
  const notifications = useAppStore((state) => state.notifications);

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId);

  const { status: updaterStatus, installNow, checkNow: checkForUpdatesNow } = useUpdater({ checkOnMount: true });

  useEffect(() => {
    // Re-check periodically so long-running instances pick up releases without a relaunch.
    const id = setInterval(() => {
      void checkForUpdatesNow();
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [checkForUpdatesNow]);

  const initialize = useCallback(async () => {
    try {
      await initializeFromCache();

      const store = await load('config.json');

      // Install the auto-reauth handler before any request fires, so a stale
      // deviceToken (backend DB reset, account deleted) self-heals on the
      // first 401 instead of leaving the user stuck on "Failed to fetch".
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
          // Token invalid, register new one
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
    if (!isAuthenticated) return;

    fetchConnections();
    fetchNotifications();

    const intervalId = setInterval(() => {
      fetchNotifications();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, fetchConnections, fetchNotifications, refreshInterval]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        fetchNotifications();
      }
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings(true);
      }
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else if (selectedNotificationId) {
          setSelectedNotification(null);
        }
      }
      if (e.key === 'Enter' && selectedNotificationId && selectedNotification) {
        window.open(selectedNotification.url, '_blank');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchNotifications, showSettings, selectedNotificationId, selectedNotification, setSelectedNotification]);

  if (isInitializing) {
    return (
      <div className="menubar-container">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-4" />
            <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">Starting up...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderUpdateBanner = () => {
    if (updaterStatus.kind === 'available') {
      const version = updaterStatus.update.version;
      return (
        <div className="px-3 py-2 bg-[var(--accent-muted)] border-b border-[var(--accent)]/20 text-[length:var(--text-xs)] flex items-center justify-between gap-2 fade-in">
          <span className="text-[var(--accent)]">
            Update available: <strong>{version}</strong>
          </span>
          <button
            onClick={() => void installNow()}
            className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--bg-base)] font-medium hover:opacity-90 active:scale-95 transition"
          >
            Install & restart
          </button>
        </div>
      );
    }
    if (updaterStatus.kind === 'downloading') {
      return (
        <div className="px-3 py-2 bg-[var(--accent-muted)] border-b border-[var(--accent)]/20 text-[length:var(--text-xs)] text-[var(--accent)] fade-in">
          Downloading update{updaterStatus.percent !== null ? `… ${updaterStatus.percent}%` : '…'}
        </div>
      );
    }
    if (updaterStatus.kind === 'ready') {
      return (
        <div className="px-3 py-2 bg-[var(--accent-muted)] border-b border-[var(--accent)]/20 text-[length:var(--text-xs)] text-[var(--accent)] fade-in">
          Update installed — relaunching…
        </div>
      );
    }
    return null;
  };

  return (
    <div className="menubar-container">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col flex-1 ${selectedNotification ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
          <Header />
          {renderUpdateBanner()}
          <NotificationList />
          <StatusBar onOpenSettings={() => setShowSettings(true)} />
        </div>
        {selectedNotification && (
          <div className="w-1/2 flex-shrink-0">
            <NotificationDetail
              notification={selectedNotification}
              onClose={() => setSelectedNotification(null)}
            />
          </div>
        )}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
