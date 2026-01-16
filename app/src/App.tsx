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
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Starting up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <Header />
      <NotificationList />
      <footer className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-2 flex justify-end">
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Settings (⌘,)"
        >
          ⚙️
        </button>
      </footer>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
