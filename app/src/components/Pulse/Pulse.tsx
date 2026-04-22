import { useEffect } from 'react';
import { usePulseStore, isFilterActive, describeFilter } from '../../store/pulse';
import { usePulse } from '../../hooks/usePulse';
import { StatsStrip } from './StatsStrip';
import { ArchiveList } from './ArchiveList';
import { FilterChip } from './FilterChip';

export function Pulse() {
  const filter = usePulseStore((s) => s.filter);
  const setFilter = usePulseStore((s) => s.setFilter);
  const clearFilter = usePulseStore((s) => s.clearFilter);
  const collapseExpand = usePulseStore((s) => s.collapseExpand);
  const expandedArchiveId = usePulseStore((s) => s.expandedArchiveId);

  const { metrics, archive, loading, error, loadMore } = usePulse(filter);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;
      if (e.key !== 'Escape') return;
      if (expandedArchiveId) {
        collapseExpand();
        return;
      }
      if (isFilterActive(filter)) {
        clearFilter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filter, expandedArchiveId, clearFilter, collapseExpand]);

  if (loading && !metrics) {
    return (
      <div className="pulse-loading">
        <div className="pulse-stats skeleton">
          <div className="pulse-volume"><span className="pulse-today">—</span> today · — avg</div>
        </div>
        <div className="pulse-archive-empty">reading archive…</div>
      </div>
    );
  }

  if (error && !metrics) {
    return <div className="pulse-archive-empty">could not read local archive. {error}</div>;
  }

  if (!metrics) return null;

  return (
    <div className="pulse-root">
      <StatsStrip
        metrics={metrics}
        activeSource={filter.source ?? null}
        activeType={filter.type ?? null}
        activeActor={filter.actor ?? null}
        activeRepo={filter.repo ?? null}
        activeHour={typeof filter.hour === 'number' ? filter.hour : null}
        onPickSource={(s) => setFilter({ source: filter.source === s ? undefined : s })}
        onPickType={(t) => setFilter({ type: filter.type === t ? undefined : t })}
        onPickActor={(name) => setFilter({ actor: filter.actor === name ? undefined : name })}
        onPickRepo={(repo) => setFilter({ repo: filter.repo === repo ? undefined : repo })}
        onPickHour={(h) => setFilter({ hour: filter.hour === h ? undefined : h })}
      />
      {isFilterActive(filter) && (
        <FilterChip label={describeFilter(filter)} onClear={clearFilter} />
      )}
      <ArchiveList
        rows={archive?.rows ?? []}
        hasMore={archive?.hasMore ?? false}
        onLoadMore={() => void loadMore()}
        emptyHint={
          isFilterActive(filter)
            ? `no matches for ${describeFilter(filter)} in the last 30 days.`
            : 'nothing archived yet. new notifications will land here.'
        }
      />
    </div>
  );
}
