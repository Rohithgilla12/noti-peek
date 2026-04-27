import type { ActorSlice } from '../../lib/pulse/reducers';
import { MiniSpark } from './MiniSpark';

interface Props {
  rows: ActorSlice[];
  spark: Record<string, number[]>;
  activeActor: string | null;
  onPick: (name: string) => void;
}

export function ActorList({ rows, spark, activeActor, onPick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="pulse-card">
        <div className="pulse-card-head">
          <h6 className="pulse-card-title">top actors</h6>
        </div>
        <div className="pulse-empty-mini">no actors yet</div>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="pulse-card pulse-list">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">top actors</h6>
        <span className="pulse-card-sub">14d trend</span>
      </div>
      <ul className="pulse-list-rows" role="list">
        {rows.map((r, i) => {
          const sel = activeActor === r.name;
          const pct = Math.round((r.count / max) * 100);
          return (
            <li key={r.name}>
              <button
                type="button"
                className={`pulse-list-row${sel ? ' active' : ''}`}
                onClick={() => onPick(r.name)}
              >
                <span className="pulse-list-rank">{String(i + 1).padStart(2, '0')}</span>
                {r.avatar ? (
                  <img className="pulse-list-avatar" src={r.avatar} alt="" />
                ) : (
                  <span className="pulse-list-avatar-fallback" aria-hidden="true">
                    {r.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="pulse-list-label">@{r.name}</span>
                <span className="pulse-list-bar" aria-hidden="true">
                  <span className="pulse-list-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="pulse-list-spark">
                  <MiniSpark
                    values={spark[r.name] ?? []}
                    width={64}
                    height={16}
                    strokeColor="var(--ink-3)"
                    fillColor="var(--bg-2)"
                  />
                </span>
                <span className="pulse-list-count">{String(r.count).padStart(2, '0')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
