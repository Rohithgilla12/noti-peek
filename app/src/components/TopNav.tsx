import { useEffect, useRef, useState } from 'react';
import { useAppStore, useUnreadCount } from '../store';
import { BrandMark } from './shared/BrandMark';

interface Props {
  onOpenSettings: () => void;
}

export function TopNav({ onOpenSettings }: Props) {
  const tab = useAppStore((s) => s.view.tab);
  const setTab = useAppStore((s) => s.setTab);
  const toggleQuickFilter = useAppStore((s) => s.toggleQuickFilter);
  const unreadActive = useAppStore((s) => s.view.filters.has('unread'));
  const unread = useUnreadCount();

  return (
    <header className="topnav" data-tauri-drag-region>
      <div className="topnav-gutter" aria-hidden data-tauri-drag-region />
      <div className="topnav-brand" aria-hidden data-tauri-drag-region>
        <span className="topnav-brand-dot"><BrandMark size={14} /></span>
        <span className="topnav-brand-name">noti-peek</span>
      </div>
      <nav className="topnav-tabs" role="tablist" data-tauri-drag-region>
        <button
          role="tab"
          aria-current={tab === 'inbox'}
          onClick={() => setTab('inbox')}
          title="Inbox (1)"
          type="button"
        >
          inbox
        </button>
        <button
          role="tab"
          aria-current={tab === 'pulse'}
          onClick={() => setTab('pulse')}
          title="Pulse (2)"
          type="button"
        >
          pulse
        </button>
      </nav>
      <div className="topnav-search" data-tauri-drag-region>
        <SearchPlaceholder />
      </div>
      <div className="topnav-actions" data-tauri-drag-region>
        {unread > 0 && (
          <button
            className="topnav-unread-chip"
            aria-pressed={unreadActive}
            onClick={() => toggleQuickFilter('unread')}
            title="Toggle unread filter (u)"
            type="button"
          >
            {unread} unread
          </button>
        )}
        <AvatarMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

function SearchPlaceholder() {
  return (
    <div
      className="topnav-search-box"
      role="search"
      aria-disabled="true"
      title="Search coming soon"
    >
      <span className="topnav-search-icon" aria-hidden>⌕</span>
      <span className="topnav-search-label">Search…</span>
      <kbd className="topnav-search-kbd">⌘K</kbd>
    </div>
  );
}

function AvatarMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastSync = useAppStore((s) => s.lastSyncTime);
  const fresh = lastSync !== null && Date.now() - lastSync.getTime() < 5 * 60 * 1000;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="topnav-avatar-wrap" ref={ref}>
      <button
        className="topnav-avatar"
        data-fresh={fresh || undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={fresh ? 'Account menu — last sync recent' : 'Account menu'}
        type="button"
      >
        ·
        <span className="topnav-avatar-presence" aria-hidden />
      </button>
      {open && (
        <div className="topnav-avatar-menu" role="menu">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            Settings… <kbd>⌘,</kbd>
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              const { emit } = await import('@tauri-apps/api/event');
              await emit('menu-check-updates');
            }}
          >
            Check for updates
          </button>
        </div>
      )}
    </div>
  );
}
