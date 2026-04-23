import type { ReactNode } from 'react';
import styles from './Sidebar.module.css';

interface Props {
  label?: string;
  children: ReactNode;
}

export function SidebarSection({ label, children }: Props) {
  return (
    <div className={styles.section}>
      {label && <div className={styles.sectionLabel}>{label}</div>}
      <div className={styles.sectionItems}>{children}</div>
    </div>
  );
}
