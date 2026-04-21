import type { Notification } from '../../lib/types';
import { timeLabel } from '../../lib/days';

interface Props {
  n: Notification;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function NotificationRow({ n, selected, onSelect, onOpen }: Props) {
  const ref = n.repo ?? n.project ?? '';
  return (
    <button
      className={`day-row ${n.unread ? 'unread' : 'read'}`}
      data-source={n.source}
      aria-current={selected}
      onClick={onSelect}
      onDoubleClick={onOpen}
      type="button"
    >
      <span className="marker" aria-hidden="true"></span>
      <span className="src">{n.source}</span>
      <span className="title">
        {ref && <span className="ref">{ref}</span>}
        <span>{n.title}</span>
        {n.author?.name && <span className="note">· {n.author.name}</span>}
      </span>
      <span className="time">{timeLabel(n.updatedAt)}</span>
    </button>
  );
}
