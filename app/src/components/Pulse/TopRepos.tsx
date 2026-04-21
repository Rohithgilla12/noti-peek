import type { RepoSlice } from '../../lib/pulse/reducers';

interface Props {
  rows: RepoSlice[];
  activeRepo: string | null;
  onPick: (repo: string) => void;
}

export function TopRepos({ rows, activeRepo, onPick }: Props) {
  if (rows.length === 0) return <div className="pulse-empty-mini">no repos yet</div>;
  return (
    <div className="pulse-block">
      <h6 className="pulse-block-title">top repos</h6>
      <ul className="pulse-rank" role="list">
        {rows.map((r) => (
          <li key={r.repo}>
            <button
              type="button"
              className={`pulse-rank-row${activeRepo === r.repo ? ' active' : ''}`}
              onClick={() => onPick(r.repo)}
            >
              <span className="pulse-rank-label">{r.repo}</span>
              <span className="pulse-rank-count">{String(r.count).padStart(2, '0')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
