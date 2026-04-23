import { useAppStore, useErroringProviders } from '../../store';
import { countForQuickFilter, countForScope, countForSource } from '../../lib/view';
import type { Provider } from '../../lib/types';
import { SidebarSection } from './SidebarSection';
import { SidebarItem } from './SidebarItem';
import { BrandMark } from '../shared/BrandMark';
import styles from './Sidebar.module.css';

interface Props { onOpenSettings: () => void }

const PROVIDERS: Array<{ id: Provider; label: string }> = [
  { id: 'github',    label: 'GitHub' },
  { id: 'linear',    label: 'Linear' },
  { id: 'jira',      label: 'Jira' },
  { id: 'bitbucket', label: 'Bitbucket' },
];

// The left glyph is the keyboard mnemonic — load-bearing chrome that
// teaches the shortcut, not a decorative icon.
const Key = ({ ch }: { ch: string }) => <span aria-hidden>{ch}</span>;

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
        <span className={styles.brandLogo}><BrandMark size={14} /></span>
        <span>noti-peek</span>
      </div>

      <SidebarSection label="Views">
        <SidebarItem icon={<Key ch="i" />} label="Inbox"     count={countForScope(notifications, 'inbox')}     active={!rail && view.scope === 'inbox'}     onClick={() => setScope('inbox')}     title="Inbox (g i)" />
        <SidebarItem icon={<Key ch="m" />} label="Mentions"  count={countForScope(notifications, 'mentions')}  active={!rail && view.scope === 'mentions'}  onClick={() => setScope('mentions')}  title="Mentions (g m)" />
        <SidebarItem icon={<Key ch="b" />} label="Bookmarks" count={countForScope(notifications, 'bookmarks')} active={!rail && view.scope === 'bookmarks'} onClick={() => setScope('bookmarks')} title="Bookmarks (g b)" />
        <SidebarItem icon={<Key ch="l" />} label="Links"     active={!rail && view.scope === 'links'}     onClick={() => setScope('links')}     title="Suggested links (g l)" />
        <SidebarItem icon={<Key ch="a" />} label="Archive"   count={countForScope(notifications, 'archive')}   active={!rail && view.scope === 'archive'}   onClick={() => setScope('archive')}   title="Archive (g a)" />
      </SidebarSection>

      <SidebarSection label="Filters">
        <SidebarItem icon={<Key ch="u" />} label="Unread" count={countForQuickFilter(notifications, 'unread')} active={!rail && view.filters.has('unread')} onClick={() => toggleQuickFilter('unread')} title="Toggle unread-only (u)" />
        <SidebarItem
          label="Errors"
          count={erroringProviders.length}
          active={false}
          disabled
          onClick={() => { /* no-op while disabled */ }}
          title="Errors surface will land in 1.1"
        />
        <SidebarItem label="PRs" count={countForQuickFilter(notifications, 'prs')} active={!rail && view.filters.has('prs')} onClick={() => toggleQuickFilter('prs')} />
      </SidebarSection>

      <SidebarSection label="Integrations">
        {PROVIDERS.map((p) => (
          <SidebarItem
            key={p.id}
            icon={<Key ch={p.label[0].toLowerCase()} />}
            label={p.label}
            count={countForSource(notifications, p.id)}
            active={!rail && view.sources.has(p.id)}
            onClick={() => toggleSource(p.id)}
          />
        ))}
      </SidebarSection>

      <div className={styles.footer}>
        <SidebarItem label="Settings" onClick={onOpenSettings} title="Settings (⌘,)" />
      </div>
    </aside>
  );
}
