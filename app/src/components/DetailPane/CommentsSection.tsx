import { openUrl } from '@tauri-apps/plugin-opener';
import type { DetailComment } from '../../lib/types';
import { sanitizeHtml } from '../../lib/sanitize';

interface Props {
  comments: DetailComment[];
  totalCount: number;
  fallbackUrl: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function CommentsSection({ comments, totalCount, fallbackUrl }: Props) {
  if (totalCount === 0) {
    return <div className="comments-empty">no comments</div>;
  }

  const shown = comments.length;
  const hidden = totalCount - shown;

  return (
    <details className="comments">
      <summary>
        {totalCount} comment{totalCount === 1 ? '' : 's'}
      </summary>
      <ol className="comments-list">
        {comments.map((c) => (
          <li key={c.id} className="comment">
            <header>
              {c.author.avatar && <img src={c.author.avatar} alt="" width={16} height={16} />}
              <span className="comment-author">{c.author.name}</span>
              <span className="comment-when">{formatWhen(c.createdAt)}</span>
            </header>
            <div
              className="comment-body"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(c.bodyHtml) }}
            />
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <button className="comments-more" type="button" onClick={() => { void openUrl(fallbackUrl); }}>
          view remaining {hidden} on provider
        </button>
      )}
    </details>
  );
}
