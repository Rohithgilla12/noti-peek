interface Props {
  hourBuckets: number[];
  mostActiveHour: number | null;
  activeHour: number | null;
  onPickHour: (h: number) => void;
}

export function HourClock({ hourBuckets, mostActiveHour, activeHour, onPickHour }: Props) {
  const max = Math.max(1, ...hourBuckets);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = 30;
  const outerR = 88;

  const total = hourBuckets.reduce((a, b) => a + b, 0);
  const morning = hourBuckets.slice(6, 12).reduce((a, b) => a + b, 0);
  const afternoon = hourBuckets.slice(12, 18).reduce((a, b) => a + b, 0);
  const evening = hourBuckets.slice(18, 24).reduce((a, b) => a + b, 0);
  const night = (hourBuckets.slice(0, 6).reduce((a, b) => a + b, 0));

  return (
    <div className="pulse-card pulse-clock">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">24-hour rhythm</h6>
        <span className="pulse-card-sub">
          {mostActiveHour !== null ? `peak ${String(mostActiveHour).padStart(2, '0')}:00` : '—'}
        </span>
      </div>
      <div className="pulse-clock-row">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="hour clock">
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--line-soft)" strokeDasharray="1 3" />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="var(--line-soft)" />
          <circle cx={cx} cy={cy} r={(outerR + innerR) / 2} fill="none" stroke="var(--line-soft)" strokeDasharray="1 5" opacity={0.6} />
          {hourBuckets.map((v, h) => {
            const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
            const ratio = v / max;
            const r = innerR + (outerR - innerR) * Math.max(0.04, ratio);
            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * r;
            const y2 = cy + Math.sin(angle) * r;
            const sel = activeHour === h;
            const peak = mostActiveHour === h;
            return (
              <line
                key={h}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={sel || peak ? 'var(--ink-1)' : 'var(--ink-3)'}
                strokeWidth={sel || peak ? 3 : 2}
                strokeLinecap="round"
                opacity={ratio === 0 ? 0.25 : 1}
              />
            );
          })}
          {hourBuckets.map((_, h) => {
            if (h % 6 !== 0) return null;
            const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
            const r = outerR + 10;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            return (
              <text
                key={h}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="var(--ink-4)"
                letterSpacing="0.08em"
              >
                {String(h).padStart(2, '0')}
              </text>
            );
          })}
          {Array.from({ length: 24 }).map((_, h) => {
            const angle = (h / 24) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(angle) * (outerR + 4);
            const y = cy + Math.sin(angle) * (outerR + 4);
            return (
              <circle
                key={`hit-${h}`}
                cx={x}
                cy={y}
                r={6}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => onPickHour(h)}
              >
                <title>{`${String(h).padStart(2, '0')}:00 · ${hourBuckets[h]}`}</title>
              </circle>
            );
          })}
          <text
            x={cx}
            y={cy - 3}
            textAnchor="middle"
            fontSize="14"
            fontFamily="var(--font-mono)"
            fill="var(--ink-1)"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 11}
            textAnchor="middle"
            fontSize="8"
            fontFamily="var(--font-mono)"
            fill="var(--ink-4)"
            letterSpacing="0.12em"
          >
            PINGS
          </text>
        </svg>
        <ul className="pulse-clock-legend" role="list">
          <SegmentRow label="night" range="00–06" count={night} total={total} />
          <SegmentRow label="morning" range="06–12" count={morning} total={total} />
          <SegmentRow label="afternoon" range="12–18" count={afternoon} total={total} />
          <SegmentRow label="evening" range="18–24" count={evening} total={total} />
        </ul>
      </div>
    </div>
  );
}

function SegmentRow({
  label,
  range,
  count,
  total,
}: {
  label: string;
  range: string;
  count: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <li className="pulse-clock-seg">
      <span className="pulse-clock-seg-label">{label}</span>
      <span className="pulse-clock-seg-range">{range}</span>
      <span className="pulse-clock-seg-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="pulse-clock-seg-pct">{pct}%</span>
    </li>
  );
}
