import { useAppStore, useErroringProviders } from '../../store';
import { countForQuickFilter, countForScope, countForSource } from '../../lib/view';
import type { Provider } from '../../lib/types';
import { SidebarSection } from './SidebarSection';
import { SidebarItem } from './SidebarItem';
import styles from './Sidebar.module.css';

interface Props { onOpenSettings: () => void }

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'github',    label: 'GitHub' },
  { id: 'linear',    label: 'Linear' },
  { id: 'jira',      label: 'Jira' },
  { id: 'bitbucket', label: 'Bitbucket' },
];

// Single-glyph icons keep the shell dependency-free.
const Icon = ({ ch }: { ch: string }) => <span aria-hidden>{ch}</span>;

export function Sidebar({ onOpenSettings }: Props) {
  const view = useAppStore((s) => s.view);
  const setScope = useAppStore((s) => s.setScope);
  const toggleQuickFilter = useAppStore((s) => s.toggleQuickFilter);
  const toggleSource = useAppStore((s) => s.toggleSource);
  const notifications = useAppStore((s) => s.notifications);
  const erroringProviders = useErroringProviders();

  const rail = view.tab === 'pulse';

  return (
    <aside className={styles.sidebar} data-rail={rail || undefined} aria-label="Navigation">
      <div className={styles.brand} data-tauri-drag-region>
        <span className={styles.brandLogo} />
        <span>noti-peek</span>
      </div>

      <SidebarSection label="Views">
        <SidebarItem icon={<Icon ch="#" />} label="Inbox"     count={countForScope(notifications, 'inbox')}     active={!rail && view.scope === 'inbox'}     onClick={() => setScope('inbox')}     title="Inbox (g i)" />
        <SidebarItem icon={<Icon ch="@" />} label="Mentions"  count={countForScope(notifications, 'mentions')}  active={!rail && view.scope === 'mentions'}  onClick={() => setScope('mentions')}  title="Mentions (g m)" />
        <SidebarItem icon={<Icon ch="★" />} label="Bookmarks" count={countForScope(notifications, 'bookmarks')} active={!rail && view.scope === 'bookmarks'} onClick={() => setScope('bookmarks')} title="Bookmarks (g b)" />
        <SidebarItem icon={<Icon ch="↗" />} label="Links"     active={!rail && view.scope === 'links'}     onClick={() => setScope('links')}     title="Suggested links (g l)" />
        <SidebarItem icon={<Icon ch="▣" />} label="Archive"   count={countForScope(notifications, 'archive')}   active={!rail && view.scope === 'archive'}   onClick={() => setScope('archive')}   title="Archive (g a)" />
      </SidebarSection>

      <SidebarSection label="Filters">
        <SidebarItem icon={<Icon ch="●" />} label="Unread"  count={countForQuickFilter(notifications, 'unread')} active={!rail && view.filters.has('unread')} onClick={() => toggleQuickFilter('unread')} title="Toggle unread-only (u)" />
        <SidebarItem
          icon={<Icon ch="!" />}
          label="Errors"
          count={erroringProviders.length}
          active={false}
          disabled
          onClick={() => { /* no-op while disabled */ }}
          title="Errors surface will land in 1.1"
        />
        <SidebarItem icon={<Icon ch="⇄" />} label="PRs"     count={countForQuickFilter(notifications, 'prs')}    active={!rail && view.filters.has('prs')}    onClick={() => toggleQuickFilter('prs')} />
      </SidebarSection>

      <SidebarSection label="Integrations">
        {PROVIDERS.map((p) => (
          <SidebarItem
            key={p.id}
            icon={<Icon ch={p.label[0]} />}
            label={p.label}
            count={countForSource(notifications, p.id)}
            active={!rail && view.sources.has(p.id)}
            onClick={() => toggleSource(p.id)}
          />
        ))}
      </SidebarSection>

      <div className={styles.footer}>
        <SidebarItem icon={<Icon ch="⚙" />} label="Settings" onClick={onOpenSettings} title="Settings (⌘,)" />
      </div>
    </aside>
  );
}
