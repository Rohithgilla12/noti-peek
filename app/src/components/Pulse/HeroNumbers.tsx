import type { PulseMetrics } from '../../lib/pulse';

interface Props {
  metrics: PulseMetrics;
}

function formatHour(h: number | null): string {
  if (h === null) return '—';
  return `${String(h).padStart(2, '0')}:00`;
}

function formatDelta(pct: number): { label: string; tone: 'up' | 'down' | 'flat' } {
  if (pct === 0) return { label: '±0%', tone: 'flat' };
  const tone = pct > 0 ? 'up' : 'down';
  const sign = pct > 0 ? '+' : '−';
  return { label: `${sign}${Math.abs(pct)}%`, tone };
}

function formatBusiestDay(date: string | undefined): string {
  if (!date) return '—';
  const d = new Date(`${date}T00:00:00`);
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleDateString(undefined, { month: 'short' }).toLowerCase();
  return `${mon} ${day}`;
}

export function HeroNumbers({ metrics }: Props) {
  const delta = formatDelta(metrics.weekDelta.deltaPct);
  return (
    <div className="pulse-hero" role="group" aria-label="summary">
      <Stat
        label="today"
        value={String(metrics.volumeToday).padStart(2, '0')}
        sub={`${metrics.volumeAvg30}/d avg`}
      />
      <Stat
        label="this week"
        value={String(metrics.weekDelta.thisWeek).padStart(2, '0')}
        sub={
          <span className={`pulse-delta tone-${delta.tone}`}>
            {delta.label} vs last
          </span>
        }
      />
      <Stat
        label="last 30d"
        value={String(metrics.total30).padStart(3, '0')}
        sub={`${metrics.bySource.length || 0} sources`}
      />
      <Stat
        label="peak hour"
        value={formatHour(metrics.mostActiveHour)}
        sub={metrics.peak ? `${metrics.peak.count} in ${metrics.peak.hourLabel}` : '—'}
      />
      <Stat
        label="busiest"
        value={formatBusiestDay(metrics.streak.busiestDay?.date)}
        sub={
          metrics.streak.busiestDay
            ? `${metrics.streak.busiestDay.count} notifications`
            : 'no spikes yet'
        }
      />
      <Stat
        label="streak"
        value={`${metrics.streak.currentStreak}d`}
        sub={`longest ${metrics.streak.longestStreak}d · ${metrics.streak.quietDays} quiet`}
      />
    </div>
  );
}

interface StatProps {
  label: string;
  value: string;
  sub: React.ReactNode;
}

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className="pulse-hero-cell">
      <div className="pulse-hero-label">{label}</div>
      <div className="pulse-hero-value">{value}</div>
      <div className="pulse-hero-sub">{sub}</div>
    </div>
  );
}
