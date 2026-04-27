import type { TypeSlice } from '../../lib/pulse/reducers';

interface Props {
  rows: TypeSlice[];
  activeType: string | null;
  onPick: (t: string) => void;
}

export function TypeRadial({ rows, activeType, onPick }: Props) {
  if (rows.length === 0) {
    return <div className="pulse-empty-mini">no type data</div>;
  }
  const top = rows.slice(0, 8);
  const max = Math.max(1, ...top.map((r) => r.count));

  return (
    <div className="pulse-card pulse-types">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">by type</h6>
        <span className="pulse-card-sub">{rows.length} kinds</span>
      </div>
      <ul className="pulse-types-list" role="list">
        {top.map((r, i) => {
          const pct = Math.round((r.count / max) * 100);
          const sel = activeType === r.type;
          return (
            <li key={r.type}>
              <button
                type="button"
                className={`pulse-types-row${sel ? ' active' : ''}`}
                onClick={() => onPick(r.type)}
              >
                <span className="pulse-types-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="pulse-types-label">{r.type}</span>
                <span className="pulse-types-bar" aria-hidden="true">
                  <span className="pulse-types-fill" style={{ width: `${pct}%` }} />
                  <span className="pulse-types-tick" />
                </span>
                <span className="pulse-types-count">{r.count}</span>
                <span className="pulse-types-pct">{r.pct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
