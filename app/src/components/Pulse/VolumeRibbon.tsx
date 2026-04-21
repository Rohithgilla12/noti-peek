interface Props {
  today: number;
  avg30: number;
  hourBuckets: number[];
  activeHour: number | null;
  onPickHour: (h: number) => void;
}

export function VolumeRibbon({ today, avg30, hourBuckets, activeHour, onPickHour }: Props) {
  const max = Math.max(1, ...hourBuckets);
  return (
    <div className="pulse-volume">
      <div className="pulse-volume-head">
        <span className="pulse-today">{String(today).padStart(2, '0')}</span>
        <span className="pulse-today-label">today</span>
        <span className="pulse-avg">~{avg30} avg</span>
      </div>
      <div className="pulse-spark" role="group" aria-label="notifications by hour">
        {hourBuckets.map((count, h) => {
          const height = Math.round((count / max) * 100);
          const selected = activeHour === h;
          return (
            <button
              key={h}
              type="button"
              className={`pulse-spark-cell${selected ? ' active' : ''}`}
              title={`${String(h).padStart(2, '0')}:00 · ${count}`}
              aria-label={`hour ${h}: ${count}`}
              onClick={() => onPickHour(h)}
            >
              <span className="pulse-spark-bar" style={{ height: `${Math.max(4, height)}%` }} />
            </button>
          );
        })}
      </div>
      <div className="pulse-spark-axis" aria-hidden="true">
        <span>00</span><span>06</span><span>12</span><span>18</span>
      </div>
    </div>
  );
}
