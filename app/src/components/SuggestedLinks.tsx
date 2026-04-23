import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import type { SuggestedLink, SuggestedLinkRationale } from '../lib/types';
import { trackSuggestedLinkShown } from '../lib/telemetry-events';

const RATIONALE_LABEL: Record<SuggestedLinkRationale, string> = {
  'author-match': 'Same author',
  'title-overlap': 'Title overlap',
  'temporal-close': 'Active together',
  'both-open': 'Both open',
  'repo-affinity': 'Repo affinity',
};

function rationaleLine(r: SuggestedLinkRationale[]): string {
  return r.map((x) => RATIONALE_LABEL[x]).join(' · ');
}

function SuggestionCard({ link }: { link: SuggestedLink }) {
  const confirm = useAppStore((s) => s.confirmLink);
  const dismiss = useAppStore((s) => s.dismissSuggestion);
  return (
    <div className="suggestion-card">
      <div className="suggestion-sides">
        <div className="suggestion-side">
          <span className={`source-badge source-${link.linked.source}`}>{link.linked.source}</span>
          <span className="suggestion-ref">{link.linked.ref}</span>
          <span className="suggestion-title">{link.linked.title}</span>
        </div>
        <span className="suggestion-arrow" aria-hidden="true">↔</span>
        <div className="suggestion-side">
          <span className={`source-badge source-${link.primary.source}`}>{link.primary.source}</span>
          <span className="suggestion-ref">{link.primary.key}</span>
          <span className="suggestion-title">{link.primary.title}</span>
        </div>
      </div>
      <div className="suggestion-meta">
        <span className="suggestion-confidence">confidence {Math.round(link.confidence * 100)}%</span>
        <span className="suggestion-rationale">{rationaleLine(link.rationale)}</span>
      </div>
      <div className="suggestion-actions">
        <button className="btn-confirm" type="button" onClick={() => void confirm(link)}>
          Link them
        </button>
        <button className="btn-dismiss" type="button" onClick={() => void dismiss(link)}>
          Not related
        </button>
      </div>
    </div>
  );
}

export function SuggestedLinks() {
  const suggestedLinks = useAppStore((s) => s.suggestedLinks);
  const clearDismissed = useAppStore((s) => s.clearDismissedSuggestions);
  const shownIds = useRef(new Set<string>());

  useEffect(() => {
    for (const link of suggestedLinks) {
      if (shownIds.current.has(link.id)) continue;
      shownIds.current.add(link.id);
      trackSuggestedLinkShown(link.pair, link.confidence);
    }
  }, [suggestedLinks]);

  return (
    <div className="suggestions-view">
      <div className="suggestions-head">
        <h4>Suggested links</h4>
        <p className="subtle">
          Noti Peek surfaces candidate cross-provider links here when it's not certain enough to auto-link.
          Confirm or dismiss — dismissed pairings never resurface.
        </p>
      </div>

      {suggestedLinks.length === 0 ? (
        <div className="empty-state">
          No suggestions right now. Noti Peek will surface cross-provider links here as it finds them.
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestedLinks.map((link) => (
            <SuggestionCard key={link.id} link={link} />
          ))}
        </div>
      )}

      <div className="suggestions-footer">
        <button type="button" className="clear-dismissed-btn" onClick={() => void clearDismissed()}>
          Clear dismissed suggestions
        </button>
      </div>
    </div>
  );
}
