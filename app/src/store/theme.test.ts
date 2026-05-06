import { describe, it, expect } from 'vitest';
import { isTheme, useAppStore } from './index';

describe('theme slice', () => {
  it('isTheme accepts dark/light, rejects everything else', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('system')).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(42)).toBe(false);
    expect(isTheme('')).toBe(false);
  });

  it('setTheme updates the store', () => {
    useAppStore.getState().setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().theme).toBe('dark');
  });
});
