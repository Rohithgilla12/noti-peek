import type { DaySourceBucket } from '../../lib/pulse/reducers';
import type { Provider } from '../../lib/types';

interface Props {
  data: DaySourceBucket[];
  activeSource: Provider | null;
  onPickSource: (s: Provider) => void;
}

const ORDER: Provider[] = ['github', 'linear', 'jira', 'bitbucket'];
const COLOR_VAR: Record<Provider, string> = {
  github: 'var(--github)',
  linear: 'var(--linear)',
  jira: 'var(--jira)',
  bitbucket: 'var(--bitbucket)',
};

export function DailyArea({ data, activeSource, onPickSource }: Props) {
  if (data.length === 0) {
    return <div className="pulse-empty-mini">no daily data yet</div>;
  }
  const W = 600;
  const H = 140;
  const PAD_T = 8;
  const PAD_B = 18;
  const PAD_L = 0;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(1, ...data.map((d) => d.total));
  const n = data.length;
  const stepX = (W - PAD_L) / Math.max(1, n - 1);

  const sources = activeSource ? [activeSource] : ORDER;
  const stacked = data.map((d) => {
    let cum = 0;
    const layers: Record<Provider, { lo: number; hi: number }> = {
      github: { lo: 0, hi: 0 },
      linear: { lo: 0, hi: 0 },
      jira: { lo: 0, hi: 0 },
      bitbucket: { lo: 0, hi: 0 },
    };
    for (const s of sources) {
      const v = d.counts[s];
      layers[s] = { lo: cum, hi: cum + v };
      cum += v;
    }
    return { total: cum, layers };
  });

  const realMax = Math.max(1, ...stacked.map((s) => s.total));
  const yScale = (v: number) => PAD_T + innerH - (v / Math.max(max, realMax)) * innerH;

  const buildPath = (s: Provider): string => {
    const top: string[] = [];
    const bottom: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = PAD_L + i * stepX;
      top.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yScale(stacked[i].layers[s].hi).toFixed(1)}`);
    }
    for (let i = n - 1; i >= 0; i--) {
      const x = PAD_L + i * stepX;
      bottom.push(`L ${x.toFixed(1)} ${yScale(stacked[i].layers[s].lo).toFixed(1)}`);
    }
    return `${top.join(' ')} ${bottom.join(' ')} Z`;
  };

  const totalsLine: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = PAD_L + i * stepX;
    totalsLine.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yScale(stacked[i].total).toFixed(1)}`);
  }

  const last = data[data.length - 1];
  const first = data[0];
  const ticks = [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n - 1];

  return (
    <div className="pulse-card pulse-area">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">daily volume — last {n} days</h6>
        <div className="pulse-legend">
          {ORDER.map((s) => {
            const dim = activeSource && activeSource !== s ? ' dim' : '';
            return (
              <button
                key={s}
                type="button"
                className={`pulse-legend-chip${dim}`}
                onClick={() => onPickSource(s)}
              >
                <span
                  className="pulse-legend-dot"
                  style={{ background: COLOR_VAR[s] }}
                  aria-hidden="true"
                />
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="pulse-area-svg"
        aria-label="daily volume by source"
      >
        <defs>
          {ORDER.map((s) => (
            <linearGradient key={s} id={`area-${s}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLOR_VAR[s]} stopOpacity="0.55" />
              <stop offset="100%" stopColor={COLOR_VAR[s]} stopOpacity="0.06" />
            </linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={0}
            x2={W}
            y1={yScale(realMax * p)}
            y2={yScale(realMax * p)}
            stroke="var(--line-soft)"
            strokeDasharray="2 3"
            strokeWidth={0.5}
          />
        ))}
        {sources.map((s) => (
          <path key={s} d={buildPath(s)} fill={`url(#area-${s})`} stroke={COLOR_VAR[s]} strokeWidth={0.8} />
        ))}
        <path d={totalsLine.join(' ')} fill="none" stroke="var(--ink-2)" strokeWidth={1} />
      </svg>
      <div className="pulse-area-axis" aria-hidden="true">
        {ticks.map((i) => {
          const d = data[i];
          if (!d) return null;
          const date = new Date(`${d.date}T00:00:00`);
          const label = i === n - 1
            ? 'today'
            : i === 0
              ? new Date(`${first.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()
              : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
          const left = (i / Math.max(1, n - 1)) * 100;
          return (
            <span
              key={i}
              className="pulse-area-tick"
              style={{ left: `${left}%` }}
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="pulse-area-foot">
        <span>{first.date}</span>
        <span className="pulse-area-foot-mid">peak {realMax}/d</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
