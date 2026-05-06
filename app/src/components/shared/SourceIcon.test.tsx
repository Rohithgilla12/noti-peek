import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceIcon, ScopeIcon } from './SourceIcon';

describe('SourceIcon', () => {
  it.each(['github', 'linear', 'jira', 'bitbucket'] as const)(
    'renders an svg for provider %s',
    (provider) => {
      const { container } = render(<SourceIcon provider={provider} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-label')).toBe(provider);
    },
  );

  it('respects the size prop', () => {
    const { container } = render(<SourceIcon provider="github" size={20} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });
});

describe('ScopeIcon', () => {
  it.each(['inbox', 'mentions', 'bookmarks', 'links', 'archive'] as const)(
    'renders an svg for scope %s',
    (scope) => {
      const { container } = render(<ScopeIcon scope={scope} />);
      expect(container.querySelector('svg')).not.toBeNull();
    },
  );
});
