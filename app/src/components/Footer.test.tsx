import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Footer } from './Footer';
import { useAppStore } from '../store';

describe('Footer presence dot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the dot fresh when lastSyncTime is under 5 minutes ago', () => {
    useAppStore.setState({
      lastSyncTime: new Date('2026-05-06T11:58:00Z'),
      connections: [],
      isLoading: false,
      isSyncing: false,
      isOffline: false,
    } as unknown as never);
    const { container } = render(<Footer />);
    const dot = container.querySelector('.footer-presence');
    expect(dot?.getAttribute('data-fresh')).toBe('true');
  });

  it('does not mark fresh when lastSyncTime is over 5 minutes ago', () => {
    useAppStore.setState({
      lastSyncTime: new Date('2026-05-06T11:50:00Z'),
      connections: [],
      isLoading: false,
      isSyncing: false,
      isOffline: false,
    } as unknown as never);
    const { container } = render(<Footer />);
    const dot = container.querySelector('.footer-presence');
    expect(dot?.getAttribute('data-fresh')).toBeNull();
  });
});
