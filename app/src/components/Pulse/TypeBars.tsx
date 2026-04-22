import type { TypeSlice } from '../../lib/pulse/reducers';

interface Props {
  rows: TypeSlice[];
  activeType: string | null;
  onPick: (t: string) => void;
}

export function TypeBars({ rows, activeType, onPick }: Props) {
  if (rows.length === 0) {
    return <div className="pulse-empty-mini">no type data</div>;
  }
  return (
    <ul className="pulse-sources" role="list">
      {rows.map((r) => {
        const selected = activeType === r.type;
        return (
          <li key={r.type}>
            <button
              type="button"
              className={`pulse-source-row${selected ? ' active' : ''}`}
              onClick={() => onPick(r.type)}
            >
              <span className="pulse-source-label">{r.type}</span>
              <span className="pulse-source-bar" aria-hidden="true">
                <span className="pulse-source-fill" style={{ width: `${r.pct}%` }} />
              </span>
              <span className="pulse-source-pct">{String(r.pct).padStart(2, ' ')}%</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
