import { useEffect, useState, useCallback } from 'react';
import { load } from '@tauri-apps/plugin-store';
import './App.css';
import { useAppStore } from './store';
import { api } from './lib/api';
import { Header } from './components/Header';
import { NotificationList } from './components/NotificationList';
import { Settings } from './components/Settings';
import { StatusBar } from './components/StatusBar';

const STORE_KEY = 'auth';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuth = useAppStore((state) => state.setAuth);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const refreshInterval = useAppStore((state) => state.refreshInterval);

  const initialize = useCallback(async () => {
    try {
      const store = await load('config.json');
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
  }, [setAuth]);

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
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fetchNotifications]);

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)] mx-auto mb-4" />
          <p className="text-[length:var(--text-sm)] text-[var(--text-secondary)]">Starting up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-base)]">
      <Header />
      <NotificationList />
      <StatusBar onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
