import type { Notification } from '../../lib/types';
import { timeLabel } from '../../lib/days';
import { SourceIcon } from './SourceIcon';

interface Props {
  n: Notification;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

function humanizeType(type: string): string {
  return type.replace(/_/g, ' ');
}

export function NotificationRow({ n, selected, onSelect, onOpen }: Props) {
  const ref = n.repo ?? n.project ?? null;
  const preview = n.body?.trim() || null;

  return (
    <button
      className={`day-row ${n.unread ? 'unread' : 'read'}`}
      data-source={n.source}
      aria-current={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      type="button"
    >
      <span className="day-row-leader">
        <SourceIcon provider={n.source} size={14} />
      </span>

      <span className="day-row-meta">
        <span className="day-row-source">{n.source}</span>
        <span className="day-row-sep">·</span>
        <span className="day-row-type">{humanizeType(n.type)}</span>
        <span className="day-row-time">{timeLabel(n.updatedAt)}</span>
      </span>

      <span className="day-row-title">{n.title}</span>

      {preview && <span className="day-row-preview">{preview}</span>}

      <span className="day-row-chips">
        {ref && <span className="day-row-chip">{ref}</span>}
        {n.author?.name && <span className="day-row-chip">{n.author.name}</span>}
      </span>

      <span
        className="day-row-status"
        data-state={n.unread ? 'unread' : 'read'}
        aria-hidden
      />

      {n.bookmarked && (
        <span className="day-row-bookmark" aria-label="bookmarked" title="bookmarked">★</span>
      )}
    </button>
  );
}
