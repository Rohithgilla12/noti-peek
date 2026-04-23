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
import { SuggestedLinks } from './components/SuggestedLinks';
import { Sidebar } from './components/Sidebar';
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
  const view = useAppStore((s) => s.view);

  const selected = notifications.find((n) => n.id === selectedId) ?? null;

  const { status: updaterStatus, installNow, checkNow: checkForUpdatesNow } =
    useUpdater({ checkOnMount: true });

  // `manualCheckActive` gates the "checking…" / "up to date" / "check failed"
  // states in UpdateBanner — they only render for user-initiated checks so
  // the 30-min auto-checks stay silent.
  const [manualCheckActive, setManualCheckActive] = useState(false);

  const handleManualCheck = useCallback(() => {
    setManualCheckActive(true);
    void checkForUpdatesNow();
  }, [checkForUpdatesNow]);

  useEffect(() => {
    const id = setInterval(() => void checkForUpdatesNow(), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [checkForUpdatesNow]);

  useEffect(() => {
    if (!manualCheckActive) return;
    if (updaterStatus.kind === 'no-update' || updaterStatus.kind === 'error') {
      const t = setTimeout(() => setManualCheckActive(false), 4000);
      return () => clearTimeout(t);
    }
  }, [manualCheckActive, updaterStatus]);

  const initialize = useCallback(async () => {
    try {
      await initializeFromCache();

      const store = await load('config.json');

      const savedTab = await store.get<'inbox' | 'pulse' | 'links'>('activeTab');
      if (savedTab === 'inbox' || savedTab === 'pulse' || savedTab === 'links') {
        useAppStore.getState().setActiveTab(savedTab);
      }

      const savedView = await store.get<{
        scope: string;
        filters: string[];
        sources: string[];
      }>('view');
      if (savedView) {
        const { setScope, toggleQuickFilter, toggleSource } = useAppStore.getState();
        const validScopes = new Set(['inbox', 'mentions', 'bookmarks', 'links', 'archive']);
        if (validScopes.has(savedView.scope)) {
          setScope(savedView.scope as Parameters<typeof setScope>[0]);
        }
        for (const f of savedView.filters) {
          if (f === 'unread' || f === 'errors' || f === 'prs') toggleQuickFilter(f);
        }
        for (const s of savedView.sources) {
          if (s === 'github' || s === 'linear' || s === 'jira' || s === 'bitbucket') {
            toggleSource(s);
          }
        }
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
    void load('config.json').then(async (s) => {
      await s.set('activeTab', view.tab);
      await s.set('view', {
        scope: view.scope,
        filters: [...view.filters],
        sources: [...view.sources],
      });
      await s.save();
    });
  }, [view]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchConnections();
    fetchNotifications();
    const id = setInterval(() => fetchNotifications(), refreshInterval);
    return () => clearInterval(id);
  }, [isAuthenticated, fetchConnections, fetchNotifications, refreshInterval]);

  useEffect(() => {
    let gPressedAt = 0; // sequence detector for `g i`, `g m`, etc.

    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;

      const now = Date.now();
      const gSequence = now - gPressedAt < 800;

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        gPressedAt = now;
        return;
      }

      if (gSequence && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        const { setScope } = useAppStore.getState();
        const keyToScope: Record<string, Parameters<typeof setScope>[0]> = {
          i: 'inbox', m: 'mentions', b: 'bookmarks', l: 'links', e: 'archive',
        };
        const scope = keyToScope[e.key];
        if (scope) {
          e.preventDefault();
          setScope(scope);
          useAppStore.getState().setTab('inbox');
          gPressedAt = 0;
          return;
        }
      }

      // ⌘R / r → refresh
      if (e.key === 'r' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        fetchNotifications();
      }
      // ⌘, → preferences
      if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings(true);
      }
      // ⌘W → hide window
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void getCurrentWindow().hide();
      }
      if (e.key === 'Escape') {
        if (showSettings) setShowSettings(false);
        else if (selectedId) setSelectedId(null);
      }
      // `1` / `2` — top-level tab switch (Inbox / Pulse). `3` dropped in Phase 1.
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) {
        useAppStore.getState().setTab('inbox');
      }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) {
        useAppStore.getState().setTab('pulse');
      }
      if (e.key === 'u' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        useAppStore.getState().toggleQuickFilter('unread');
      }
      if (e.key === 'Enter' && selected) {
        void openUrl(selected.url).catch((err) => console.error('open url failed:', err));
        if (selected.unread) markAsRead(selected.id);
      }
      if (e.key === 'Enter' && !selected) {
        const rows = useAppStore.getState().rows;
        const firstBundle = rows.find((r) => r.kind !== 'single');
        if (firstBundle) {
          useAppStore.getState().toggleExpanded(firstBundle.bundle.id);
        }
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('comment-textarea')?.focus();
      }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !e.shiftKey && selected) {
        const rows = useAppStore.getState().rows;
        const containing = rows.find((r) =>
          r.kind === 'cross_bundle' && r.bundle.children.some((c) => c.id === selected.id),
        );
        if (containing && containing.kind === 'cross_bundle') {
          e.preventDefault();
          void useAppStore.getState().markCrossBundleRead(containing.bundle.id);
          return;
        }
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
  }, [fetchNotifications, showSettings, selectedId, selected, setSelectedId, markAsRead, markAllAsRead]);

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
      listen('menu-check-updates', () => handleManualCheck()),
    ];
    return () => {
      for (const p of unlisteners) void p.then((fn) => fn());
    };
  }, [fetchNotifications, setFilter, filter.unreadOnly, handleManualCheck]);

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
    <div className="app-shell" data-tab={view.tab}>
      <TopNav onOpenSettings={() => setShowSettings(true)} />
      <UpdateBanner
        status={updaterStatus}
        manualFeedback={manualCheckActive}
        onInstall={() => void installNow()}
      />
      <div className="sidebar-col">
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
      </div>
      <main className="app-main" data-single-column={view.tab === 'pulse' || undefined}>
        {view.tab === 'pulse' ? (
          <section className="pulse-col">
            <Pulse />
          </section>
        ) : view.scope === 'links' ? (
          <section className="links-col">
            <SuggestedLinks />
          </section>
        ) : (
          <>
            <section className="stream-col">
              <DayStream />
            </section>
            <section className="detail-col">
              <DetailPane notification={selected} />
            </section>
          </>
        )}
      </main>
      <Footer />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function UpdateBanner({
  status,
  manualFeedback,
  onInstall,
}: {
  status: ReturnType<typeof useUpdater>['status'];
  manualFeedback: boolean;
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
  if (manualFeedback && status.kind === 'checking') {
    return <div className="update-banner">checking for updates…</div>;
  }
  if (manualFeedback && status.kind === 'no-update') {
    return <div className="update-banner">you're on the latest version</div>;
  }
  if (manualFeedback && status.kind === 'error') {
    return <div className="update-banner">update check failed — {status.message}</div>;
  }
  return null;
}

export default App;
