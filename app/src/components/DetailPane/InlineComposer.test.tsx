import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineComposer } from './InlineComposer';

describe('InlineComposer', () => {
  it('calls onFallback on Cmd+Enter when textarea has content', () => {
    const onFallback = vi.fn();
    render(<InlineComposer onFallback={onFallback} initials="R" />);
    const textarea = screen.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'looks good to me' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onFallback).toHaveBeenCalledWith('looks good to me');
  });

  it('does not call onFallback when textarea is empty', () => {
    const onFallback = vi.fn();
    render(<InlineComposer onFallback={onFallback} initials="R" />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
    expect(onFallback).not.toHaveBeenCalled();
  });

  it('does not call onFallback on plain Enter', () => {
    const onFallback = vi.fn();
    render(<InlineComposer onFallback={onFallback} initials="R" />);
    const textarea = screen.getByPlaceholderText('Add a comment…');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onFallback).not.toHaveBeenCalled();
  });
});
