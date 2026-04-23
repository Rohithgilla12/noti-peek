import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { load as loadTauriStore } from '@tauri-apps/plugin-store';
import type { Notification, Connection, Provider, DetailResponse, NotificationRow, SuggestedLink } from '../lib/types';
import { api } from '../lib/api';
import * as db from '../lib/db';
import { notifyNew } from '../lib/notify';
import {
  trackSuggestedLinkConfirmed,
  trackSuggestedLinkDismissed,
  trackCrossBundleMarkAllRead,
} from '../lib/telemetry-events';

function markRowsReadOne(rows: NotificationRow[], id: string): NotificationRow[] {
  return rows.map((r) => {
    if (r.kind === 'single') {
      return r.notification.id === id
        ? { ...r, notification: { ...r.notification, unread: false } }
        : r;
    }
    const childIdx = r.bundle.children.findIndex((c) => c.id === id);
    if (childIdx < 0) return r;
    const children = r.bundle.children.map((c) =>
      c.id === id ? { ...c, unread: false } : c,
    );
    const unread_count = children.filter((c) => c.unread).length;
    if (r.kind === 'bundle') {
      return { ...r, bundle: { ...r.bundle, children, unread_count } };
    }
    return { ...r, bundle: { ...r.bundle, children, unread_count } };
  });
}

function markRowsReadAll(rows: NotificationRow[]): NotificationRow[] {
  return rows.map((r) => {
    if (r.kind === 'single') {
      return r.notification.unread
        ? { ...r, notification: { ...r.notification, unread: false } }
        : r;
    }
    const children = r.bundle.children.map((c) =>
      c.unread ? { ...c, unread: false } : c,
    );
    if (r.kind === 'bundle') {
      return { ...r, bundle: { ...r.bundle, children, unread_count: 0 } };
    }
    return { ...r, bundle: { ...r.bundle, children, unread_count: 0 } };
  });
}

async function readBundlingPrefs(): Promise<{ crossEnabled: boolean; suggestEnabled: boolean }> {
  try {
    const s = await loadTauriStore('config.json');
    const cpb = await s.get<boolean>('crossProviderBundling');
    const snl = await s.get<boolean>('suggestNewLinks');
    return {
      crossEnabled: cpb !== false,
      suggestEnabled: snl !== false,
    };
  } catch {
    return { crossEnabled: true, suggestEnabled: true };
  }
}

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
  isSyncing: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  isOffline: boolean;

  notifications: Notification[];
  connections: Connection[];

  filter: {
    source: Provider | 'all';
    unreadOnly: boolean;
    type: string | 'all';
  };

  selectedNotificationId: string | null;

  refreshInterval: number;

  activeTab: 'inbox' | 'pulse' | 'links';
  setActiveTab: (tab: 'inbox' | 'pulse' | 'links') => void;

  rows: NotificationRow[];
  bundlingVersion: number;
  suggestedLinks: SuggestedLink[];

  expandedBundleIds: Set<string>;
  toggleExpanded: (id: string) => void;
  collapseAll: () => void;

  confirmLink: (link: SuggestedLink) => Promise<void>;
  dismissSuggestion: (link: SuggestedLink) => Promise<void>;
  clearDismissedSuggestions: () => Promise<void>;

  markCrossBundleRead: (bundleId: string) => Promise<void>;

  setAuth: (deviceToken: string, userId: string) => void;
  clearAuth: () => void;

  setNotifications: (notifications: Notification[]) => void;
  setConnections: (connections: Connection[]) => void;

  setFilter: (filter: Partial<AppState['filter']>) => void;
  setRefreshInterval: (interval: number) => void;
  setSelectedNotification: (id: string | null) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  initializeFromCache: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearCache: () => Promise<void>;

  detailsCache: Record<string, { response: DetailResponse; cachedAt: number }>;
  inFlightDetails: Map<string, Promise<DetailResponse>>;

  fetchDetails: (notification: Notification) => Promise<DetailResponse>;
  performAction: (
    notification: Notification,
    action: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  deviceToken: null,
  userId: null,
  isAuthenticated: false,
  isLoading: false,
  isSyncing: false,
  error: null,
  lastSyncTime: null,
  isOffline: false,

  notifications: [],
  connections: [],

  filter: {
    source: 'all',
    unreadOnly: false,
    type: 'all',
  },

  selectedNotificationId: null,

  refreshInterval: 5 * 60 * 1000,

  detailsCache: {},
  inFlightDetails: new Map<string, Promise<DetailResponse>>(),

  rows: [],
  bundlingVersion: 1,
  suggestedLinks: [],
  expandedBundleIds: new Set<string>(),

  activeTab: 'inbox',
  setActiveTab: (activeTab) => set({ activeTab }),

  toggleExpanded: (id) => set((s) => {
    const next = new Set(s.expandedBundleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { expandedBundleIds: next };
  }),

  collapseAll: () => set({ expandedBundleIds: new Set<string>() }),

  confirmLink: async (link) => {
    await api.confirmSuggestedLink({
      pair: link.pair,
      primary_key: link.primary.key,
      linked_ref: link.linked.ref,
    });
    trackSuggestedLinkConfirmed(link.pair);
    set((s) => ({ suggestedLinks: s.suggestedLinks.filter((x) => x.id !== link.id) }));
    await get().fetchNotifications();
  },

  dismissSuggestion: async (link) => {
    await api.dismissSuggestedLink({
      pair: link.pair,
      primary_key: link.primary.key,
      linked_ref: link.linked.ref,
    });
    trackSuggestedLinkDismissed(link.pair);
    set((s) => ({ suggestedLinks: s.suggestedLinks.filter((x) => x.id !== link.id) }));
  },

  clearDismissedSuggestions: async () => {
    await api.clearDismissedSuggestions();
    await get().fetchNotifications();
  },

  markCrossBundleRead: async (bundleId) => {
    const rows = get().rows;
    const bundle = rows
      .filter((r): r is Extract<NotificationRow, { kind: 'cross_bundle' }> => r.kind === 'cross_bundle')
      .map((r) => r.bundle)
      .find((b) => b.id === bundleId);
    if (!bundle) return;
    const markPromises = bundle.children
      .filter((c) => c.unread)
      .map((c) => get().markAsRead(c.id).catch((err) => {
        console.error('markCrossBundleRead: child failed', c.id, err);
      }));
    await Promise.all(markPromises);
    trackCrossBundleMarkAllRead(bundle.pair, bundle.children.length);
  },

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

  initializeFromCache: async () => {
    try {
      await db.initDatabase();
      const [cachedNotifications, cachedConnections, lastSync] = await Promise.all([
        db.getCachedNotifications(),
        db.getCachedConnections(),
        db.getLastSyncTime(),
      ]);

      if (cachedNotifications.length > 0) {
        set({ notifications: cachedNotifications });
        const unreadCount = cachedNotifications.filter(n => n.unread).length;
        await updateBadgeCount(unreadCount);
      }

      if (cachedConnections.length > 0) {
        set({ connections: cachedConnections });
      }

      if (lastSync) {
        set({ lastSyncTime: lastSync });
      }
    } catch (err) {
      console.error('Failed to load from cache:', err);
    }
  },

  fetchNotifications: async () => {
    const { notifications: existingNotifications, lastSyncTime } = get();
    const hasCache = existingNotifications.length > 0;

    set({
      isLoading: !hasCache,
      isSyncing: hasCache,
      error: null,
      isOffline: false,
    });

    try {
      const response = await api.getNotifications();
      const { notifications: incoming, errors } = response;

      // Preserve local "read" intent across syncs. Providers like GitHub are
      // eventually consistent — right after mark-all-as-read, GET still
      // returns unread:true for the same threads, which would otherwise
      // clobber the local state. We only trust the provider's unread flag
      // when updatedAt has advanced (i.e. there's genuine new activity).
      const existingById = new Map(existingNotifications.map((n) => [n.id, n]));
      const notifications = incoming.map((n) => {
        const prev = existingById.get(n.id);
        if (prev && !prev.unread && new Date(n.updatedAt).getTime() <= new Date(prev.updatedAt).getTime()) {
          return { ...n, unread: false };
        }
        return n;
      });

      // Diff against the previous fetch to find notifications we haven't
      // told the OS about yet. Only fire system notifications once we
      // have a prior sync on record — otherwise first launch after a
      // long weekend would spam a wall of banners.
      const newlyArrived = lastSyncTime
        ? notifications.filter((n) => n.unread && !existingById.has(n.id))
        : [];

      const prefs = await readBundlingPrefs();
      const incomingRows = response.rows ?? [];
      const rows: NotificationRow[] = prefs.crossEnabled
        ? incomingRows
        : incomingRows.flatMap((r) =>
            r.kind === 'cross_bundle'
              ? r.bundle.children.map((n) => ({ kind: 'single' as const, notification: n }))
              : [r]
          );
      const suggestedLinks = prefs.suggestEnabled ? (response.suggested_links ?? []) : [];

      set({
        notifications,
        lastSyncTime: new Date(),
        rows,
        bundlingVersion: response.bundling_version ?? 1,
        suggestedLinks,
      });

      const unreadCount = notifications.filter((n) => n.unread).length;
      await updateBadgeCount(unreadCount);

      await db.cacheNotifications(notifications);

      // Cap banners at 3 per sync so a burst (e.g. a PR with 10 review
      // comments) becomes one or two notifications, not a storm.
      for (const n of newlyArrived.slice(0, 3)) {
        void notifyNew(n);
      }

      if (errors && errors.length > 0) {
        set({ error: errors.map((e) => `${e.provider}: ${e.error}`).join(', ') });
      }
    } catch (err) {
      const isNetworkError = err instanceof Error &&
        (err.message.includes('fetch') || err.message.includes('network'));

      if (isNetworkError && existingNotifications.length > 0) {
        set({ isOffline: true, error: 'Offline - showing cached data' });
      } else {
        set({ error: err instanceof Error ? err.message : 'Failed to fetch notifications' });
      }
    } finally {
      set({ isLoading: false, isSyncing: false });
    }
  },

  fetchConnections: async () => {
    try {
      const { connections } = await api.getConnections();
      set({ connections });
      await db.cacheConnections(connections);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  },

  markAsRead: async (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, unread: false } : n
      );
      const unreadCount = notifications.filter(n => n.unread).length;
      updateBadgeCount(unreadCount);
      return { notifications, rows: markRowsReadOne(state.rows, id) };
    });

    await db.updateNotificationReadStatus(id, false);

    try {
      await api.markAsRead(id);
    } catch (err) {
      console.error('Failed to sync read status:', err);
    }
  },

  markAllAsRead: async () => {
    const { filter } = get();
    const source = filter.source === 'all' ? undefined : filter.source;

    set((state) => {
      const notifications = state.notifications.map((n) =>
        filter.source === 'all' || n.source === filter.source
          ? { ...n, unread: false }
          : n
      );
      const unreadCount = notifications.filter(n => n.unread).length;
      updateBadgeCount(unreadCount);
      return { notifications, rows: markRowsReadAll(state.rows) };
    });

    await db.markAllNotificationsRead(source);

    try {
      await api.markAllAsRead(source);
    } catch (err) {
      console.error('Failed to sync mark all as read:', err);
    }
  },

  clearCache: async () => {
    await db.clearAllCache();
    set({ notifications: [], connections: [], lastSyncTime: null });
  },

  fetchDetails: async (notification) => {
    const key = `${notification.id}@${notification.updatedAt}`;
    const cached = get().detailsCache[key];
    if (cached) return cached.response;

    const existing = get().inFlightDetails.get(key);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const response = await api.fetchDetails(notification.id, notification.url);
        set((state) => {
          const entries = Object.entries(state.detailsCache);
          entries.push([key, { response, cachedAt: Date.now() }]);
          const kept = entries
            .sort(([, a], [, b]) => b.cachedAt - a.cachedAt)
            .slice(0, 50);
          const nextCache: Record<string, { response: DetailResponse; cachedAt: number }> = {};
          for (const [k, v] of kept) nextCache[k] = v;
          const nextInFlight = new Map(state.inFlightDetails);
          nextInFlight.delete(key);
          return { detailsCache: nextCache, inFlightDetails: nextInFlight };
        });
        return response;
      } catch (err) {
        set((state) => {
          const nextInFlight = new Map(state.inFlightDetails);
          nextInFlight.delete(key);
          return { inFlightDetails: nextInFlight };
        });
        throw err;
      }
    })();

    set((state) => {
      const nextInFlight = new Map(state.inFlightDetails);
      nextInFlight.set(key, promise);
      return { inFlightDetails: nextInFlight };
    });

    return promise;
  },

  performAction: async (notification, action, payload) => {
    const fullPayload = { url: notification.url, ...payload };
    const result = await api.performAction(notification.id, action, fullPayload);
    if (!result?.details) {
      throw new Error('action response missing details');
    }
    const response = result.details;
    const key = `${notification.id}@${notification.updatedAt}`;
    set((state) => ({
      detailsCache: {
        ...state.detailsCache,
        [key]: { response, cachedAt: Date.now() },
      },
    }));
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