import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedSideEffect } from './useDebouncedSideEffect';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useDebouncedSideEffect', () => {
  it('does not run the effect before the delay elapses', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedSideEffect(fn, 400));

    act(() => result.current());
    act(() => vi.advanceTimersByTime(399));

    expect(fn).not.toHaveBeenCalled();
  });

  it('runs the effect once after the delay elapses', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedSideEffect(fn, 400));

    act(() => result.current());
    act(() => vi.advanceTimersByTime(400));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid calls into a single trailing invocation', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedSideEffect(fn, 400));

    act(() => {
      result.current();
      vi.advanceTimersByTime(200);
      result.current();
      vi.advanceTimersByTime(200);
      result.current();
    });
    act(() => vi.advanceTimersByTime(400));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('forwards the latest arguments to the effect', () => {
    const fn = vi.fn<(value: string) => void>();
    const { result } = renderHook(() => useDebouncedSideEffect(fn, 400));

    act(() => {
      result.current('first');
      result.current('second');
    });
    act(() => vi.advanceTimersByTime(400));

    expect(fn).toHaveBeenCalledExactlyOnceWith('second');
  });

  it('always calls the most recent fn without changing callback identity', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useDebouncedSideEffect(fn, 400), {
      initialProps: { fn: first },
    });
    const initialCallback = result.current;

    act(() => result.current());
    rerender({ fn: second });
    expect(result.current).toBe(initialCallback);

    act(() => vi.advanceTimersByTime(400));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending effect on unmount', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedSideEffect(fn, 400));

    act(() => result.current());
    unmount();
    act(() => vi.advanceTimersByTime(400));

    expect(fn).not.toHaveBeenCalled();
  });
});
