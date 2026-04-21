import { useState } from 'react';
import { useAppStore } from '../../store';
import { InsufficientScopeError } from '../../lib/api';
import type { Notification, NotificationDetails } from '../../lib/types';

interface Props {
  notification: Notification;
  details: NotificationDetails;
}

type Confirm =
  | { kind: 'close' }
  | { kind: 'merge'; method: 'merge' | 'squash' | 'rebase' }
  | { kind: 'request_changes' };

export function ActionsBar({ notification, details }: Props) {
  const performAction = useAppStore((s) => s.performAction);
  const [comment, setComment] = useState('');
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [transitionId, setTransitionId] = useState<string>('');

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setInFlight(true);
    setError(null);
    try {
      await performAction(notification, action, payload);
      setComment('');
      setConfirm(null);
    } catch (err) {
      if (err instanceof InsufficientScopeError) {
        setError(`reconnect ${err.provider} to enable actions`);
      } else {
        setError(err instanceof Error ? err.message : 'action failed');
      }
    } finally {
      setInFlight(false);
    }
  }

  function commentPayload(): Record<string, unknown> {
    return { body: comment };
  }

  return (
    <div className="actions-bar" aria-busy={inFlight}>
      {confirm && (
        <div className="confirm-row">
          <span>are you sure?</span>
          <button
            type="button"
            disabled={inFlight}
            onClick={() => {
              if (confirm.kind === 'close') void run('close');
              else if (confirm.kind === 'merge') void run('merge', { method: confirm.method });
              else if (confirm.kind === 'request_changes') void run('request_changes', { body: comment });
            }}
          >
            confirm
          </button>
          <button type="button" disabled={inFlight} onClick={() => setConfirm(null)}>cancel</button>
        </div>
      )}

      {details.kind === 'github_issue' && (
        <div className="action-row">
          {details.state === 'open'
            ? <button type="button" disabled={inFlight || !details.permissions.canClose} onClick={() => setConfirm({ kind: 'close' })}>close</button>
            : <button type="button" disabled={inFlight || !details.permissions.canClose} onClick={() => void run('reopen')}>reopen</button>
          }
        </div>
      )}

      {details.kind === 'github_pr' && (
        <div className="action-row">
          {details.permissions.canReview && (
            <>
              <button type="button" disabled={inFlight} onClick={() => void run('approve', { body: comment || undefined })}>approve</button>
              <button type="button" disabled={inFlight || !comment.trim()} onClick={() => setConfirm({ kind: 'request_changes' })}>request changes</button>
            </>
          )}
          {details.permissions.canMerge && (
            <button type="button" data-action="merge" disabled={inFlight} onClick={() => setConfirm({ kind: 'merge', method: 'squash' })}>merge (squash)</button>
          )}
          {details.permissions.canClose && (
            details.state === 'open'
              ? <button type="button" disabled={inFlight} onClick={() => setConfirm({ kind: 'close' })}>close</button>
              : <button type="button" disabled={inFlight} onClick={() => void run('reopen')}>reopen</button>
          )}
        </div>
      )}

      {details.kind === 'jira_issue' && (
        <div className="action-row">
          <select
            value={transitionId}
            disabled={inFlight || details.availableTransitions.length === 0}
            onChange={(e) => setTransitionId(e.target.value)}
          >
            <option value="">transition to…</option>
            {details.availableTransitions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={inFlight || !transitionId}
            onClick={() => { void run('transition', { transitionId }); setTransitionId(''); }}
          >
            go
          </button>
          <button
            type="button"
            disabled={inFlight || details.assignee?.accountId === details.currentUser.accountId}
            onClick={() => void run('assign_self')}
          >
            assign to me
          </button>
        </div>
      )}

      <div className="comment-row">
        <textarea
          id="comment-textarea"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="comment…"
          rows={2}
          disabled={inFlight}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && comment.trim()) {
              e.preventDefault();
              void run('comment', commentPayload());
            }
          }}
        />
        <button
          type="button"
          disabled={inFlight || !comment.trim()}
          onClick={() => void run('comment', commentPayload())}
        >
          comment
        </button>
      </div>

      {error && <div className="actions-error">{error}</div>}
    </div>
  );
}
