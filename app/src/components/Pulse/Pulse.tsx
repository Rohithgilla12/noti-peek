import { useEffect } from 'react';
import { usePulseStore, isFilterActive, describeFilter } from '../../store/pulse';
import { usePulse } from '../../hooks/usePulse';
import { HeroNumbers } from './HeroNumbers';
import { DailyArea } from './DailyArea';
import { CalendarHeatmap } from './CalendarHeatmap';
import { WeekHourMatrix } from './WeekHourMatrix';
import { SourceDonut } from './SourceDonut';
import { HourClock } from './HourClock';
import { TypeRadial } from './TypeRadial';
import { ActorList } from './ActorList';
import { RepoList } from './RepoList';
import { FilterChip } from './FilterChip';

export function Pulse() {
  const filter = usePulseStore((s) => s.filter);
  const setFilter = usePulseStore((s) => s.setFilter);
  const clearFilter = usePulseStore((s) => s.clearFilter);

  const { metrics, loading, error } = usePulse(filter);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
      if (typing) return;
      if (e.key !== 'Escape') return;
      if (isFilterActive(filter)) clearFilter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filter, clearFilter]);

  if (loading && !metrics) {
    return (
      <div className="pulse-loading">
        <div className="pulse-archive-empty">crunching the last 30 days…</div>
      </div>
    );
  }

  if (error && !metrics) {
    return <div className="pulse-archive-empty">could not read local archive. {error}</div>;
  }

  if (!metrics) return null;

  const empty = metrics.total30 === 0;

  return (
    <div className="pulse-root">
      {isFilterActive(filter) && (
        <FilterChip label={describeFilter(filter)} onClear={clearFilter} />
      )}
      <div className="pulse-dash">
        <HeroNumbers metrics={metrics} />
        {empty ? (
          <div className="pulse-archive-empty">
            no notifications archived in the last 30 days yet. once they start landing, this view will fill in.
          </div>
        ) : (
          <>
            <DailyArea
              data={metrics.dailyBySource}
              activeSource={filter.source ?? null}
              onPickSource={(s) => setFilter({ source: filter.source === s ? undefined : s })}
            />
            <CalendarHeatmap data={metrics.daily} />
            <div className="pulse-grid pulse-grid-2">
              <SourceDonut
                rows={metrics.bySource}
                total={metrics.total30}
                activeSource={filter.source ?? null}
                onPick={(s) => setFilter({ source: filter.source === s ? undefined : s })}
              />
              <HourClock
                hourBuckets={metrics.hourBuckets}
                mostActiveHour={metrics.mostActiveHour}
                activeHour={typeof filter.hour === 'number' ? filter.hour : null}
                onPickHour={(h) => setFilter({ hour: filter.hour === h ? undefined : h })}
              />
            </div>
            <WeekHourMatrix
              matrix={metrics.weekHour}
              activeHour={typeof filter.hour === 'number' ? filter.hour : null}
              onPickHour={(h) => setFilter({ hour: filter.hour === h ? undefined : h })}
            />
            <div className="pulse-grid pulse-grid-2">
              <TypeRadial
                rows={metrics.byType}
                activeType={filter.type ?? null}
                onPick={(t) => setFilter({ type: filter.type === t ? undefined : t })}
              />
              <ActorList
                rows={metrics.byActor}
                spark={metrics.actorSpark}
                activeActor={filter.actor ?? null}
                onPick={(name) => setFilter({ actor: filter.actor === name ? undefined : name })}
              />
            </div>
            <RepoList
              rows={metrics.byRepo}
              spark={metrics.repoSpark}
              activeRepo={filter.repo ?? null}
              onPick={(r) => setFilter({ repo: filter.repo === r ? undefined : r })}
            />
          </>
        )}
      </div>
    </div>
  );
}
