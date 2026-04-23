import type { ReactNode } from 'react';
import styles from './Sidebar.module.css';

interface Props {
  icon: ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  title?: string;
}

export function SidebarItem({ icon, label, count, active = false, onClick, title }: Props) {
  return (
    <button
      type="button"
      className={styles.item}
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      title={title}
    >
      <span className={styles.itemIcon} aria-hidden>{icon}</span>
      <span className={styles.itemLabel}>{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className={styles.itemCount}>{count}</span>
      )}
    </button>
  );
}
