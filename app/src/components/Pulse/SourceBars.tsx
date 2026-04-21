import type { SourceSlice } from '../../lib/pulse/reducers';
import type { Provider } from '../../lib/types';

interface Props {
  rows: SourceSlice[];
  activeSource: Provider | null;
  onPick: (s: Provider) => void;
}

export function SourceBars({ rows, activeSource, onPick }: Props) {
  if (rows.length === 0) {
    return <div className="pulse-empty-mini">no source data</div>;
  }
  return (
    <ul className="pulse-sources" role="list">
      {rows.map((r) => {
        const selected = activeSource === r.source;
        return (
          <li key={r.source}>
            <button
              type="button"
              className={`pulse-source-row${selected ? ' active' : ''}`}
              onClick={() => onPick(r.source)}
            >
              <span className="pulse-source-label">{r.source}</span>
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
