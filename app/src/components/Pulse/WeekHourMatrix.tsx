interface Props {
  matrix: number[][];
  activeHour: number | null;
  onPickHour: (h: number) => void;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function WeekHourMatrix({ matrix, activeHour, onPickHour }: Props) {
  let max = 1;
  for (const row of matrix) for (const v of row) if (v > max) max = v;
  const totalByHour = new Array(24).fill(0);
  for (const row of matrix) row.forEach((v, h) => (totalByHour[h] += v));
  const totalByDay = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const grandTotal = totalByDay.reduce((a, b) => a + b, 0);

  return (
    <div className="pulse-card pulse-wh">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">weekday × hour</h6>
        <span className="pulse-card-sub">{grandTotal} pings · 7d × 24h</span>
      </div>
      <div className="pulse-wh-grid">
        <div className="pulse-wh-corner" aria-hidden="true" />
        <div className="pulse-wh-hours" aria-hidden="true">
          {Array.from({ length: 24 }).map((_, h) => (
            <span
              key={h}
              className={`pulse-wh-hour${activeHour === h ? ' active' : ''}`}
              data-tick={h % 6 === 0}
            >
              {h % 6 === 0 ? String(h).padStart(2, '0') : ''}
            </span>
          ))}
        </div>
        {matrix.map((row, dow) => (
          <div key={dow} className="pulse-wh-row-wrap">
            <span className="pulse-wh-day">{DAYS[dow]}</span>
            <div className="pulse-wh-row">
              {row.map((v, h) => {
                const ratio = v / max;
                const sel = activeHour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    className={`pulse-wh-cell${sel ? ' active' : ''}${v === 0 ? ' empty' : ''}`}
                    style={{ '--cell-alpha': ratio.toFixed(3) } as React.CSSProperties}
                    onClick={() => onPickHour(h)}
                    title={`${DAYS[dow]} ${String(h).padStart(2, '0')}:00 · ${v}`}
                    aria-label={`${DAYS[dow]} ${h}:00 — ${v}`}
                  />
                );
              })}
            </div>
            <span className="pulse-wh-total">{String(totalByDay[dow]).padStart(2, '0')}</span>
          </div>
        ))}
        <div className="pulse-wh-corner" aria-hidden="true" />
        <div className="pulse-wh-hour-totals" aria-hidden="true">
          {totalByHour.map((v, h) => (
            <span
              key={h}
              className="pulse-wh-hour-total"
              style={{ '--bar-h': `${Math.round((v / Math.max(1, ...totalByHour)) * 100)}%` } as React.CSSProperties}
              title={`${String(h).padStart(2, '0')}:00 · ${v}`}
            />
          ))}
        </div>
        <div className="pulse-wh-corner" aria-hidden="true" />
      </div>
    </div>
  );
}
