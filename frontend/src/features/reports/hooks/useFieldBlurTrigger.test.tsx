import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDirtyFieldTracker } from '../model/dirtyFieldTracker';
import { type AutosaveScheduler, useFieldBlurTrigger } from './useFieldBlurTrigger';

function resetTracker(): void {
  useDirtyFieldTracker.setState({ dirtyFields: new Set(), inFlight: null });
}

/**
 * Test harness: a step container with a couple of named inputs, wired to the
 * Field_Blur_Trigger. The container ref is forwarded to the hook.
 */
function Harness({
  scheduler,
  enabled = true,
}: {
  scheduler: AutosaveScheduler;
  enabled?: boolean;
}) {
  const containerRef = useFieldBlurTrigger({ scheduler, enabled });
  // Attach the hook's ref to the section element.
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
      <input name="untracked_field" aria-label="untracked" />
      <button type="button" aria-label="no-name-button">
        click
      </button>
    </div>
  );
}

afterEach(() => {
  resetTracker();
  vi.restoreAllMocks();
});

describe('useFieldBlurTrigger', () => {
  it('schedules a blur autosave when a dirty field loses focus', () => {
    resetTracker();
    useDirtyFieldTracker.getState().markDirty('car_model');
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.blur(getByLabelText('car_model'));

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith('blur');
  });

  it('does not schedule when the blurred field is not dirty', () => {
    resetTracker();
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.blur(getByLabelText('untracked'));

    expect(schedule).not.toHaveBeenCalled();
  });

  it('resolves nested dot-path field ids from the name attribute', () => {
    resetTracker();
    useDirtyFieldTracker.getState().markDirty('repair_works.0.note');
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.blur(getByLabelText('note'));

    expect(schedule).toHaveBeenCalledExactlyOnceWith('blur');
  });

  it('ignores blur on elements without a name attribute', () => {
    resetTracker();
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} />);

    fireEvent.blur(getByLabelText('no-name-button'));

    expect(schedule).not.toHaveBeenCalled();
  });

  it('does not attach the trigger when disabled', () => {
    resetTracker();
    useDirtyFieldTracker.getState().markDirty('car_model');
    const schedule = vi.fn();
    const { getByLabelText } = render(<Harness scheduler={{ schedule }} enabled={false} />);

    fireEvent.blur(getByLabelText('car_model'));

    expect(schedule).not.toHaveBeenCalled();
  });
});
