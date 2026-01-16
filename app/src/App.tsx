import { useEffect, useState, useCallback } from 'react';
import { load } from '@tauri-apps/plugin-store';
import './App.css';
import { useAppStore } from './store';
import { api } from './lib/api';
import { Header } from './components/Header';
import { NotificationList } from './components/NotificationList';
import { Settings } from './components/Settings';

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
      <footer className="sticky bottom-0 bg-[var(--bg-base)] border-t border-[var(--border-muted)] p-2 flex justify-end">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
          title="Settings (Cmd+,)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </footer>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
