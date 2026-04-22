import type { PulseMetrics } from '../../lib/pulse';
import type { Provider } from '../../lib/types';
import { VolumeRibbon } from './VolumeRibbon';
import { SourceBars } from './SourceBars';
import { TypeBars } from './TypeBars';
import { TopActors } from './TopActors';
import { TopRepos } from './TopRepos';

interface Props {
  metrics: PulseMetrics;
  activeSource: Provider | null;
  activeType: string | null;
  activeActor: string | null;
  activeRepo: string | null;
  activeHour: number | null;
  onPickSource: (s: Provider) => void;
  onPickType: (t: string) => void;
  onPickActor: (name: string) => void;
  onPickRepo: (repo: string) => void;
  onPickHour: (h: number) => void;
}

export function StatsStrip(p: Props) {
  return (
    <div className="pulse-stats">
      <VolumeRibbon
        today={p.metrics.volumeToday}
        avg30={p.metrics.volumeAvg30}
        hourBuckets={p.metrics.hourBuckets}
        mostActiveHour={p.metrics.mostActiveHour}
        activeHour={p.activeHour}
        onPickHour={p.onPickHour}
      />
      <div className="pulse-two-col">
        <SourceBars
          rows={p.metrics.bySource}
          activeSource={p.activeSource}
          onPick={p.onPickSource}
        />
        <TypeBars
          rows={p.metrics.byType}
          activeType={p.activeType}
          onPick={p.onPickType}
        />
      </div>
      <div className="pulse-two-col">
        {p.activeActor ? null : (
          <TopActors rows={p.metrics.byActor} activeActor={p.activeActor} onPick={p.onPickActor} />
        )}
        {p.activeRepo ? null : (
          <TopRepos rows={p.metrics.byRepo} activeRepo={p.activeRepo} onPick={p.onPickRepo} />
        )}
      </div>
    </div>
  );
}
