import type { ActorSlice } from '../../lib/pulse/reducers';

interface Props {
  rows: ActorSlice[];
  activeActor: string | null;
  onPick: (name: string) => void;
}

export function TopActors({ rows, activeActor, onPick }: Props) {
  if (rows.length === 0) return <div className="pulse-empty-mini">no actors yet</div>;
  return (
    <div className="pulse-block">
      <h6 className="pulse-block-title">top actors</h6>
      <ul className="pulse-rank" role="list">
        {rows.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              className={`pulse-rank-row${activeActor === r.name ? ' active' : ''}`}
              onClick={() => onPick(r.name)}
            >
              <span className="pulse-rank-label">@{r.name}</span>
              <span className="pulse-rank-count">{String(r.count).padStart(2, '0')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
