import { openUrl } from '@tauri-apps/plugin-opener';
import { useAppStore } from '../store';
import type { Notification } from '../lib/types';

interface Props {
  notification: Notification | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
  try {
    await openUrl(url);
  } catch (err) {
    console.error('Failed to open URL:', err);
  }
}

export function DetailPane({ notification }: Props) {
  const markAsRead = useAppStore((s) => s.markAsRead);

  if (!notification) {
    return (
      <div className="detail">
        <div className="empty">
          <span>select a notification to read it here</span>
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

  return (
    <div className="detail" data-source={n.source}>
      <div className="meta">
        <span className="src">
          {n.source} · {humanizeType(n.type)}
        </span>
        {ref && <span className="ref">{ref}</span>}
        <span title={formatDateTime(n.updatedAt)}>{formatRelative(n.updatedAt)}</span>
      </div>

      <h2>{n.title}</h2>

      {n.body && n.body.trim().length > 0 && (
        <div className="body">{n.body}</div>
      )}

      <dl className="detail-fields">
        {ref && (
          <>
            <dt>{n.repo ? 'repo' : 'project'}</dt>
            <dd>{ref}</dd>
          </>
        )}
        <dt>type</dt>
        <dd>{humanizeType(n.type)}</dd>
        {n.author?.name && (
          <>
            <dt>from</dt>
            <dd className="detail-author">
              {n.author.avatar && (
                <img src={n.author.avatar} alt="" width={16} height={16} />
              )}
              <span>{n.author.name}</span>
            </dd>
          </>
        )}
        <dt>updated</dt>
        <dd>{formatDateTime(n.updatedAt)}</dd>
        <dt>created</dt>
        <dd>{formatDateTime(n.createdAt)}</dd>
        <dt>status</dt>
        <dd className={n.unread ? 'tag-unread' : 'tag-read'}>
          {n.unread ? 'unread' : 'read'}
        </dd>
        <dt>link</dt>
        <dd>
          <button className="detail-link" onClick={() => void openExternalUrl(n.url)}>
            {n.url}
          </button>
        </dd>
      </dl>

      <div className="actions">
        <button className="primary" onClick={() => void handleOpen()} type="button">
          open
        </button>
        {n.unread && (
          <button onClick={() => markAsRead(n.id)} type="button">
            mark read
          </button>
        )}
        <span className="spacer"></span>
        <span className="keys">
          <kbd>⏎</kbd> open · <kbd>esc</kbd> close
        </span>
      </div>
    </div>
  );
}
