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

const STORE_KEY = 'auth';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuth = useAppStore((state) => state.setAuth);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);
  const fetchConnections = useAppStore((state) => state.fetchConnections);
  const refreshInterval = useAppStore((state) => state.refreshInterval);
  const selectedNotificationId = useAppStore((state) => state.selectedNotificationId);
  const setSelectedNotification = useAppStore((state) => state.setSelectedNotification);
  const notifications = useAppStore((state) => state.notifications);

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId);

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

  return (
    <div className="menubar-container">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-col flex-1 ${selectedNotification ? 'w-1/2' : 'w-full'} transition-all duration-300`}>
          <Header />
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
