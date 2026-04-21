import { useAppStore } from '../store';
import type { Notification } from '../lib/types';

interface Props {
  notification: Notification | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
  const ref = n.repo ?? n.project ?? '';

  const openExternal = () => {
    window.open(n.url, '_blank');
    if (n.unread) markAsRead(n.id);
  };

  return (
    <div className="detail" data-source={n.source}>
      <div className="meta">
        <span className="src">{n.source} · {n.type.replace(/_/g, ' ')}</span>
        {ref && <span className="ref">{ref}</span>}
        <span>{formatTime(n.updatedAt)}</span>
      </div>
      <h2>{n.title}</h2>
      {n.body ? (
        <div className="body">{n.body}</div>
      ) : (
        <div />
      )}
      <div className="thread-placeholder"></div>
      <div className="actions">
        <button className="primary" onClick={openExternal} type="button">
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
