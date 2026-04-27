import type { DayBucket } from '../../lib/pulse/reducers';

interface Props {
  data: DayBucket[];
}

const WEEKDAY_LABELS = ['mon', 'wed', 'fri'];

export function CalendarHeatmap({ data }: Props) {
  if (data.length === 0) {
    return <div className="pulse-empty-mini">no calendar data yet</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const firstDate = new Date(`${data[0].date}T00:00:00`);
  const firstDow = (firstDate.getDay() + 6) % 7;
  const totalCells = firstDow + data.length;
  const weeks = Math.ceil(totalCells / 7);

  const cells: Array<{ date: string; count: number } | null> = new Array(firstDow).fill(null);
  for (const d of data) cells.push({ date: d.date, count: d.count });
  while (cells.length < weeks * 7) cells.push(null);

  const intensity = (c: number): string => {
    if (c === 0) return 'pulse-cal-cell pulse-cal-0';
    const ratio = c / max;
    if (ratio < 0.2) return 'pulse-cal-cell pulse-cal-1';
    if (ratio < 0.4) return 'pulse-cal-cell pulse-cal-2';
    if (ratio < 0.7) return 'pulse-cal-cell pulse-cal-3';
    return 'pulse-cal-cell pulse-cal-4';
  };

  return (
    <div className="pulse-card pulse-cal">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">{data.length}-day grid</h6>
        <div className="pulse-cal-legend" aria-hidden="true">
          <span>less</span>
          <span className="pulse-cal-cell pulse-cal-0" />
          <span className="pulse-cal-cell pulse-cal-1" />
          <span className="pulse-cal-cell pulse-cal-2" />
          <span className="pulse-cal-cell pulse-cal-3" />
          <span className="pulse-cal-cell pulse-cal-4" />
          <span>more</span>
        </div>
      </div>
      <div className="pulse-cal-body">
        <div className="pulse-cal-rows" aria-hidden="true">
          <span style={{ gridRow: 1 }}>{WEEKDAY_LABELS[0]}</span>
          <span style={{ gridRow: 3 }}>{WEEKDAY_LABELS[1]}</span>
          <span style={{ gridRow: 5 }}>{WEEKDAY_LABELS[2]}</span>
        </div>
        <div
          className="pulse-cal-grid"
          style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}
        >
          {Array.from({ length: weeks * 7 }).map((_, idx) => {
            const week = idx % weeks;
            const dow = Math.floor(idx / weeks);
            const flatIdx = week * 7 + dow;
            const cell = cells[flatIdx];
            if (!cell) {
              return (
                <span
                  key={idx}
                  className="pulse-cal-cell pulse-cal-empty"
                  style={{ gridColumn: week + 1, gridRow: dow + 1 }}
                />
              );
            }
            return (
              <span
                key={idx}
                className={intensity(cell.count)}
                style={{ gridColumn: week + 1, gridRow: dow + 1 }}
                title={`${cell.date} · ${cell.count}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
