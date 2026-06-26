import { act, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AutosaveScheduler,
  DEFAULT_EDIT_DEBOUNCE_MS,
  useEditDebounceTrigger,
} from './useEditDebounceTrigger';

/**
 * Test harness: a step container with a couple of named inputs, wired to the
 * Edit_Debounce_Trigger. The container ref is forwarded to the hook.
 */
function Harness({
  scheduler,
  debounceMs,
  enabled = true,
}: {
  scheduler: AutosaveScheduler;
  debounceMs?: number;
  enabled?: boolean;
}) {
  const containerRef = useEditDebounceTrigger({ scheduler, debounceMs, enabled });
  const localRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={(node) => {
        localRef.current = node;
        (containerRef as { current: HTMLElement | null }).current = node;
      }}
    >
      <input name="car_model" aria-label="car_model" />
      <textarea name="repair_works.0.note" aria-label="note" />
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useEditDebounceTrigger', () => {
  it('schedules an edit autosave after the silence window elapses', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.input(getByLabelText('car_model'), { target: { value: 'a' } });
    expect(schedule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS);
    });

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith('edit');
  });

  it('does not fire before the silence window completes', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.input(getByLabelText('car_model'), { target: { value: 'a' } });

    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS - 1);
    });

    expect(schedule).not.toHaveBeenCalled();
  });

  it('resets the timer on each input so only one trigger fires per quiet period', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    const input = getByLabelText('car_model');
    fireEvent.input(input, { target: { value: 'a' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // A second keystroke before the window elapses restarts the silence window.
    fireEvent.input(input, { target: { value: 'ab' } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // 2000 ms total elapsed, but only 1000 ms of silence after the last input.
    expect(schedule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS - 1000);
    });
    expect(schedule).toHaveBeenCalledExactlyOnceWith('edit');
  });

  it('fires once per distinct quiet period across multiple edits', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    const input = getByLabelText('note');
    fireEvent.input(input, { target: { value: 'first' } });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS);
    });
    expect(schedule).toHaveBeenCalledTimes(1);

    fireEvent.input(input, { target: { value: 'second' } });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS);
    });
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('honours a custom debounce within the AC 2.4 window', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} debounceMs={2000} />);

    fireEvent.input(getByLabelText('car_model'), { target: { value: 'a' } });

    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(schedule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(schedule).toHaveBeenCalledExactlyOnceWith('edit');
  });

  it('does not attach the trigger when disabled', () => {
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} enabled={false} />);

    fireEvent.input(getByLabelText('car_model'), { target: { value: 'a' } });
    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS);
    });

    expect(schedule).not.toHaveBeenCalled();
  });

  it('cancels a pending trigger on unmount', () => {
    const schedule = vi.fn();
    const { getByLabelText, unmount } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.input(getByLabelText('car_model'), { target: { value: 'a' } });
    unmount();

    act(() => {
      vi.advanceTimersByTime(DEFAULT_EDIT_DEBOUNCE_MS);
    });

    expect(schedule).not.toHaveBeenCalled();
  });
});
