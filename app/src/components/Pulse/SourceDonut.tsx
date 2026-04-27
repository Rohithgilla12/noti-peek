import type { SourceSlice } from '../../lib/pulse/reducers';
import type { Provider } from '../../lib/types';

interface Props {
  rows: SourceSlice[];
  total: number;
  activeSource: Provider | null;
  onPick: (s: Provider) => void;
}

const COLOR_VAR: Record<Provider, string> = {
  github: 'var(--github)',
  linear: 'var(--linear)',
  jira: 'var(--jira)',
  bitbucket: 'var(--bitbucket)',
};

export function SourceDonut({ rows, total, activeSource, onPick }: Props) {
  if (rows.length === 0) {
    return <div className="pulse-empty-mini">no source data</div>;
  }
  const size = 160;
  const r = 64;
  const stroke = 18;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="pulse-card pulse-donut">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">by source</h6>
        <span className="pulse-card-sub">{total} total</span>
      </div>
      <div className="pulse-donut-row">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="source breakdown">
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--bg-2)"
            strokeWidth={stroke}
          />
          {rows.map((row) => {
            const len = (row.count / total) * circ;
            const dim = activeSource && activeSource !== row.source ? 0.18 : 1;
            const seg = (
              <circle
                key={row.source}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={COLOR_VAR[row.source]}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                opacity={dim}
                style={{ transition: 'opacity 160ms ease' }}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += len;
            return seg;
          })}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="22"
            fontFamily="var(--font-mono)"
            fill="var(--ink-1)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fill="var(--ink-4)"
            letterSpacing="0.12em"
          >
            LAST 30D
          </text>
        </svg>
        <ul className="pulse-donut-legend" role="list">
          {rows.map((row) => {
            const sel = activeSource === row.source;
            return (
              <li key={row.source}>
                <button
                  type="button"
                  className={`pulse-donut-item${sel ? ' active' : ''}`}
                  onClick={() => onPick(row.source)}
                >
                  <span
                    className="pulse-donut-dot"
                    style={{ background: COLOR_VAR[row.source] }}
                    aria-hidden="true"
                  />
                  <span className="pulse-donut-label">{row.source}</span>
                  <span className="pulse-donut-pct">{row.pct}%</span>
                  <span className="pulse-donut-count">{String(row.count).padStart(3, ' ')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
