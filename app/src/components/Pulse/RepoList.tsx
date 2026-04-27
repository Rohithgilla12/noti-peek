import type { RepoSlice } from '../../lib/pulse/reducers';
import { MiniSpark } from './MiniSpark';

interface Props {
  rows: RepoSlice[];
  spark: Record<string, number[]>;
  activeRepo: string | null;
  onPick: (repo: string) => void;
}

export function RepoList({ rows, spark, activeRepo, onPick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="pulse-card">
        <div className="pulse-card-head">
          <h6 className="pulse-card-title">top repos</h6>
        </div>
        <div className="pulse-empty-mini">no repos yet</div>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="pulse-card pulse-list">
      <div className="pulse-card-head">
        <h6 className="pulse-card-title">top repos / projects</h6>
        <span className="pulse-card-sub">14d trend</span>
      </div>
      <ul className="pulse-list-rows" role="list">
        {rows.map((r, i) => {
          const sel = activeRepo === r.repo;
          const pct = Math.round((r.count / max) * 100);
          return (
            <li key={r.repo}>
              <button
                type="button"
                className={`pulse-list-row${sel ? ' active' : ''}`}
                onClick={() => onPick(r.repo)}
              >
                <span className="pulse-list-rank">{String(i + 1).padStart(2, '0')}</span>
                <span className="pulse-list-label pulse-list-label-mono">{r.repo}</span>
                <span className="pulse-list-bar" aria-hidden="true">
                  <span className="pulse-list-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="pulse-list-spark">
                  <MiniSpark
                    values={spark[r.repo] ?? []}
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
