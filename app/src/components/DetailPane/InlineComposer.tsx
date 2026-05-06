import { useState } from 'react';

interface Props {
  initials: string;
  onFallback: (text: string) => void;
}

export function InlineComposer({ initials, onFallback }: Props) {
  const [text, setText] = useState('');

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const t = text.trim();
      if (!t) return;
      onFallback(t);
      setText('');
    }
  }

  return (
    <div className="inline-composer">
      <span className="inline-composer-avatar" aria-hidden>{initials}</span>
      <textarea
        id="comment-textarea"
        className="inline-composer-input"
        placeholder="Add a comment…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
      />
      <span className="inline-composer-hint"><kbd>⌘</kbd> Enter to send</span>
    </div>
  );
}
