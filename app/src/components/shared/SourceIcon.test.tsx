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

describe('SourceIcon a11y + props', () => {
  it('applies className', () => {
    const { container } = render(<SourceIcon provider="github" className="text-red-500" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain('text-red-500');
  });

  it('defaults to size 14', () => {
    const { container } = render(<SourceIcon provider="github" />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(container.querySelector('svg')?.getAttribute('height')).toBe('14');
  });

  it('exposes role="img" for screen readers', () => {
    const { container } = render(<SourceIcon provider="github" />);
    expect(container.querySelector('svg')?.getAttribute('role')).toBe('img');
  });
});

describe('ScopeIcon size prop', () => {
  it('respects the size prop', () => {
    const { container } = render(<ScopeIcon scope="inbox" size={20} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('20');
  });
});
