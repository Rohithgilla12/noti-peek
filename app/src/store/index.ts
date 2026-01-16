import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Notification, Connection, Provider } from '../lib/types';
import { api } from '../lib/api';

const updateBadgeCount = async (count: number) => {
  try {
    await invoke('set_badge_count', { count });
  } catch (err) {
    console.error('Failed to update badge count:', err);
  }
};

interface AppState {
  deviceToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastSyncTime: Date | null;

  notifications: Notification[];
  connections: Connection[];

  filter: {
    source: Provider | 'all';
    unreadOnly: boolean;
    type: string | 'all';
  };

  selectedNotificationId: string | null;

  refreshInterval: number;

  setAuth: (deviceToken: string, userId: string) => void;
  clearAuth: () => void;

  setNotifications: (notifications: Notification[]) => void;
  setConnections: (connections: Connection[]) => void;

  setFilter: (filter: Partial<AppState['filter']>) => void;
  setRefreshInterval: (interval: number) => void;
  setSelectedNotification: (id: string | null) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  fetchNotifications: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  deviceToken: null,
  userId: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastSyncTime: null,

  notifications: [],
  connections: [],

  filter: {
    source: 'all',
    unreadOnly: false,
    type: 'all',
  },

  selectedNotificationId: null,

  refreshInterval: 5 * 60 * 1000,

  setAuth: (deviceToken, userId) => {
    api.setDeviceToken(deviceToken);
    set({ deviceToken, userId, isAuthenticated: true });
  },

  clearAuth: () => {
    api.setDeviceToken(null);
    set({ deviceToken: null, userId: null, isAuthenticated: false });
  },

  setNotifications: (notifications) => set({ notifications }),
  setConnections: (connections) => set({ connections }),

  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter },
  })),

  setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
  setSelectedNotification: (selectedNotificationId) => set({ selectedNotificationId }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const { notifications, errors } = await api.getNotifications();
      set({ notifications, lastSyncTime: new Date() });
      const unreadCount = notifications.filter(n => n.unread).length;
      await updateBadgeCount(unreadCount);
      if (errors && errors.length > 0) {
        set({ error: errors.map(e => `${e.provider}: ${e.error}`).join(', ') });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch notifications' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchConnections: async () => {
    try {
      const { connections } = await api.getConnections();
      set({ connections });
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  },

  markAsRead: async (id) => {
    try {
      await api.markAsRead(id);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n.id === id ? { ...n, unread: false } : n
        );
        const unreadCount = notifications.filter(n => n.unread).length;
        updateBadgeCount(unreadCount);
        return { notifications };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to mark as read' });
    }
  },

  markAllAsRead: async () => {
    const { filter } = get();
    try {
      await api.markAllAsRead(filter.source === 'all' ? undefined : filter.source);
      set((state) => {
        const notifications = state.notifications.map((n) =>
          filter.source === 'all' || n.source === filter.source
            ? { ...n, unread: false }
            : n
        );
        const unreadCount = notifications.filter(n => n.unread).length;
        updateBadgeCount(unreadCount);
        return { notifications };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to mark all as read' });
    }
  },
}));

export const useFilteredNotifications = () => {
  const notifications = useAppStore((state) => state.notifications);
  const filter = useAppStore((state) => state.filter);

  return notifications.filter((n) => {
    if (filter.source !== 'all' && n.source !== filter.source) return false;
    if (filter.unreadOnly && !n.unread) return false;
    if (filter.type !== 'all' && n.type !== filter.type) return false;
    return true;
  });
};

export const useNotificationTypes = () => {
  const notifications = useAppStore((state) => state.notifications);
  const types = new Set(notifications.map((n) => n.type));
  return Array.from(types).sort();
};

export const useUnreadCount = () => {
  const notifications = useAppStore((state) => state.notifications);
  return notifications.filter((n) => n.unread).length;
};
