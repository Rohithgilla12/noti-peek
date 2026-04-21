import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../store';
import { sanitizeHtml } from '../lib/sanitize';
import { api, InsufficientScopeError } from '../lib/api';
import type { Notification, DetailResponse } from '../lib/types';
import { StatusStrip } from './DetailPane/StatusStrip';
import { CommentsSection } from './DetailPane/CommentsSection';
import { ActionsBar } from './DetailPane/ActionsBar';

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

export function DetailPane({ notification }: Props) {
  const markAsRead = useAppStore((s) => s.markAsRead);
  const fetchDetails = useAppStore((s) => s.fetchDetails);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [scopeReconnectUrl, setScopeReconnectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!notification) {
      setDetail(null);
      setDetailError(null);
      setScopeReconnectUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetailError(null);
    setScopeReconnectUrl(null);

    fetchDetails(notification)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof InsufficientScopeError) {
          setScopeReconnectUrl(err.reconnectUrl);
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
        <div className="empty"><span>select a notification to read it here</span></div>
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
      <div className="meta">
        <span className="src">{n.source} · {humanizeType(n.type)}</span>
        {ref && <span className="ref">{ref}</span>}
        <span title={formatDateTime(n.updatedAt)}>{formatRelative(n.updatedAt)}</span>
      </div>

      <h2>{n.title}</h2>

      {details && <StatusStrip details={details} />}

      {loading && <div className="detail-loading">loading…</div>}

      {scopeReconnectUrl && (
        <div className="detail-banner">
          <span>reconnect {n.source} to load full details and enable actions</span>
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

      {details && !scopeReconnectUrl && <ActionsBar notification={n} details={details} />}

      <div className="actions">
        <button className="primary" onClick={() => void handleOpen()} type="button">open</button>
        {n.unread && <button onClick={() => markAsRead(n.id)} type="button">mark read</button>}
        <span className="spacer"></span>
        <span className="keys">
          <kbd>⏎</kbd> open · <kbd>c</kbd> comment{isGitHub && details?.kind === 'github_pr' ? ' · ' : ''}
          {details?.kind === 'github_pr' && <><kbd>m</kbd> merge · </>}
          <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
}
