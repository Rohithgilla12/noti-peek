import { useEffect, useRef, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../store';
import { sanitizeHtml } from '../lib/sanitize';
import { api, ReconnectRequiredError } from '../lib/api';
import type { Notification, DetailResponse } from '../lib/types';
import { StatusStrip } from './DetailPane/StatusStrip';
import { CommentsSection } from './DetailPane/CommentsSection';
import { ActionsBar } from './DetailPane/ActionsBar';
import { MetadataGrid } from './DetailPane/MetadataGrid';
import { InlineComposer } from './DetailPane/InlineComposer';

interface Props {
  notification: Notification | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function humanizeType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function openExternalUrl(url: string) {
  try { await openUrl(url); } catch (err) { console.error('Failed to open URL:', err); }
}

async function reconnect(source: 'github' | 'jira' | string) {
  try {
    const url = source === 'jira' ? await api.getJiraAuthUrl() : await api.getGitHubAuthUrl();
    await openUrl(url);
  } catch (err) {
    console.error('Failed to start reconnect:', err);
  }
}

function OverflowMenu({ notification }: { notification: Notification }) {
  const archiveNotification = useAppStore((s) => s.archiveNotification);
  const unarchiveNotification = useAppStore((s) => s.unarchiveNotification);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notification.url);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
    setOpen(false);
  };

  return (
    <div className="detail-overflow" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More actions">…</button>
      {open && (
        <div className="detail-overflow-menu" role="menu">
          {notification.archived ? (
            <button
              type="button"
              onClick={() => {
                void unarchiveNotification(notification.id);
                setOpen(false);
              }}
            >
              Unarchive
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                void archiveNotification(notification.id);
                setOpen(false);
              }}
            >
              Archive
            </button>
          )}
          <button type="button" onClick={() => void handleCopy()}>Copy link</button>
          <button type="button" disabled title="Coming soon">Mute thread</button>
        </div>
      )}
    </div>
  );
}

export function DetailPane({ notification }: Props) {
  const markAsRead = useAppStore((s) => s.markAsRead);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const fetchDetails = useAppStore((s) => s.fetchDetails);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [scopeReconnectUrl, setScopeReconnectUrl] = useState<string | null>(null);
  const [reconnectReason, setReconnectReason] = useState<'insufficient_scope' | 'token_expired' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!notification) {
      setDetail(null);
      setDetailError(null);
      setScopeReconnectUrl(null);
      setReconnectReason(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetailError(null);
    setScopeReconnectUrl(null);
    setReconnectReason(null);

    fetchDetails(notification)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ReconnectRequiredError) {
          setScopeReconnectUrl(err.reconnectUrl);
          setReconnectReason(err.reason);
          setDetailError(null);
        } else {
          setDetailError(err instanceof Error ? err.message : 'failed to load details');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [notification?.id, notification?.updatedAt, fetchDetails]);

  if (!notification) {
    return (
      <div className="detail">
        <div className="empty">
          <div className="box">
            <span className="prompt">no message</span>
            <span className="hint"><kbd>j</kbd> <kbd>k</kbd> to move · <kbd>↵</kbd> to open</span>
          </div>
        </div>
      </div>
    );
  }

  const n = notification;
  const ref = n.repo ?? n.project ?? null;

  const handleOpen = async () => {
    await openExternalUrl(n.url);
    if (n.unread) markAsRead(n.id);
  };

  const details = detail?.details;
  const isGitHub = details?.kind === 'github_issue' || details?.kind === 'github_pr';
  const bodyHtml = details
    ? (details.kind === 'jira_issue' ? details.descriptionHtml : details.bodyHtml)
    : '';
  return (
    <div className="detail" data-source={n.source}>
      <div className="detail-header">
        <button
          className="detail-header-primary"
          onClick={() => void handleOpen()}
          type="button"
          title="Open in browser (⏎)"
        >
          Open in browser
        </button>
        {n.unread && (
          <button
            className="detail-header-ghost"
            onClick={() => markAsRead(n.id)}
            type="button"
            title="Mark read (e)"
          >
            Mark read
          </button>
        )}
        <button
          className="detail-header-icon"
          aria-pressed={!!n.bookmarked}
          onClick={() => void toggleBookmark(n.id)}
          type="button"
          title={n.bookmarked ? 'Remove bookmark (b)' : 'Bookmark (b)'}
        >
          {n.bookmarked ? '★' : '☆'}
        </button>
        <OverflowMenu notification={n} />
      </div>
      <div className="meta">
        <span className="src">{n.source} · {humanizeType(n.type)}</span>
        {ref && <span className="ref">{ref}</span>}
        <span title={formatDateTime(n.updatedAt)}>{formatRelative(n.updatedAt)}</span>
      </div>

      <h2>{n.title}</h2>

      {details && (
        <MetadataGrid
          details={details}
          repo={n.repo ?? undefined}
          project={n.project ?? undefined}
          branch={'baseRef' in (details as object) ? (details as { baseRef?: string }).baseRef : undefined}
          author={n.author?.name ?? undefined}
          updatedAt={n.updatedAt}
        />
      )}

      {details && <StatusStrip details={details} />}

      {loading && <div className="detail-loading">loading…</div>}

      {scopeReconnectUrl && (
        <div className="detail-banner">
          <span>
            {reconnectReason === 'token_expired'
              ? `your ${n.source} session expired — reconnect to load full details`
              : `reconnect ${n.source} to load full details and enable actions`}
          </span>
          <button type="button" onClick={() => void reconnect(n.source)}>reconnect</button>
        </div>
      )}

      {detailError && !scopeReconnectUrl && (
        <div className="detail-hint">couldn't load full details — showing basics</div>
      )}

      {bodyHtml && !scopeReconnectUrl && (
        <div className="body html-body" dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodyHtml) }} />
      )}

      {!bodyHtml && n.body && <div className="body">{n.body}</div>}

      {details && !scopeReconnectUrl && (
        <CommentsSection
          comments={details.comments}
          totalCount={details.commentCount}
          fallbackUrl={n.url}
        />
      )}

      {details && !scopeReconnectUrl && (
        <InlineComposer
          initials="R"
          onFallback={(text) => {
            void openExternalUrl(n.url);
            console.info('inline comment composer not wired yet — opened in browser', { textLength: text.length });
          }}
        />
      )}

      {details && !scopeReconnectUrl && <ActionsBar notification={n} details={details} />}

      <div className="actions">
        <span className="keys">
          <kbd>⏎</kbd> open · <kbd>c</kbd> comment{isGitHub && details?.kind === 'github_pr' ? ' · ' : ''}
          {details?.kind === 'github_pr' && <><kbd>m</kbd> merge · </>}
          <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
}
