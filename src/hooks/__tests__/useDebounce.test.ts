// @ts-nocheck
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  // @ts-nocheck
afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('updated');
  });

  it('should handle multiple rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    rerender({ value: 'second' });
    rerender({ value: 'third' });
    rerender({ value: 'fourth' });

    expect(result.current).toBe('first');

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('fourth');
  });

  it('should reset timer on new value', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    expect(result.current).toBe('first');

    rerender({ value: 'second' });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    // Still should be first since 250ms < 500ms delay
    expect(result.current).toBe('first');

    rerender({ value: 'third' });
    // Still should be first since timer was reset
    expect(result.current).toBe('first');

    // Wait for full delay after last update
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe('third');
  });
});

