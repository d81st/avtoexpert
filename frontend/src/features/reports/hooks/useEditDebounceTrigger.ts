import { type RefObject, useEffect, useRef } from 'react';
import type { AutosaveScheduler } from './useFieldBlurTrigger';

/**
 * Edit_Debounce_Trigger (Requirement 2, AC 2.4).
 *
 * Activates Smart_Autosave after a quiet period of `debounceMs` milliseconds
 * during which **no** `input` event fires inside the Wizard steps
 * `step2`/`step3`/`step4` subtree. Every `input` event resets the debounce
 * timer; once the timer elapses without interruption the hook calls
 * `scheduler.schedule('edit')` exactly once for that quiet period.
 *
 * AC 2.4 mandates a silence interval of **≥ 1500 ms and ≤ 2000 ms**. The
 * default {@link UseEditDebounceTriggerOptions.debounceMs} of `1500` sits at the
 * lower bound — the earliest compliant moment — matching the
 * `SmartAutosaveConfig.editDebounceMs` constant in `design.md` (§3.2).
 *
 * Unlike the {@link import('./useFieldBlurTrigger').useFieldBlurTrigger}
 * companion, this trigger does **not** consult the Dirty_Field_Tracker before
 * firing: AC 2.4 keys purely on input silence. The Smart_Autosave coordinator
 * (task 14.5) is responsible for suppressing the request when the tracker is
 * empty (AC 2.3), so this hook only signals "the user has paused typing".
 *
 * ## Cross-task dependency on task 14.5 (`smartAutosave.ts`)
 *
 * The Smart_Autosave coordinator
 * (`frontend/src/features/reports/model/smartAutosave.ts`) is implemented by
 * task 14.5 and is **not** created here. Following the established pattern of
 * the sibling `useFieldBlurTrigger` hook, the scheduler is injected via
 * {@link UseEditDebounceTriggerOptions.scheduler}. The injected object only
 * needs to satisfy {@link AutosaveScheduler} (re-exported from
 * `useFieldBlurTrigger.ts`), whose `schedule('edit')` signature matches the
 * `SmartAutosaveAPI.schedule` contract in `design.md` (§3.2). When 14.5 exports
 * the coordinator singleton, the Wizard wiring (task 14.9) passes it straight
 * into this hook — no change to this file is required because `smartAutosave`
 * already conforms to {@link AutosaveScheduler}.
 */

// Re-export so consumers and the Wizard wiring can import the scheduler contract
// from either trigger hook interchangeably.
export type { AutosaveScheduler, AutosaveTrigger } from './useFieldBlurTrigger';

/**
 * AC 2.4 silence window lower bound (ms). Used as the default debounce so the
 * trigger fires at the earliest compliant moment.
 */
export const DEFAULT_EDIT_DEBOUNCE_MS = 1500;

export interface UseEditDebounceTriggerOptions {
  /**
   * Smart_Autosave coordinator (task 14.5). Injected so the hook stays decoupled
   * from the coordinator module and remains testable in isolation.
   */
  scheduler: AutosaveScheduler;
  /**
   * Silence threshold in milliseconds. Must lie within the AC 2.4 window of
   * `[1500, 2000]`. Defaults to {@link DEFAULT_EDIT_DEBOUNCE_MS}.
   */
  debounceMs?: number;
  /**
   * When `false`, no `input` listener is attached (e.g. the active Wizard step
   * is outside `step2`/`step3`/`step4`). Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Binds the Edit_Debounce_Trigger to a Wizard step subtree.
 *
 * Attach the returned ref to the container element wrapping the step's
 * Form_Input_Fields. The hook installs a single `input` listener on that
 * container (the `input` event bubbles, so the container observes input from
 * any descendant field). On each `input` event it (re)arms a `debounceMs`
 * timer; when the timer elapses without a further `input` event it calls
 * `scheduler.schedule('edit')`.
 *
 * @returns A ref to attach to the step container element.
 */
export function useEditDebounceTrigger({
  scheduler,
  debounceMs = DEFAULT_EDIT_DEBOUNCE_MS,
  enabled = true,
}: UseEditDebounceTriggerOptions): RefObject<HTMLElement | null> {
  const containerRef = useRef<HTMLElement | null>(null);
  // Keep the latest scheduler without re-installing the listener on every render.
  const schedulerRef = useRef(scheduler);
  schedulerRef.current = scheduler;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = (): void => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const handleInput = (): void => {
      // Each new input event restarts the silence window (AC 2.4): the trigger
      // only fires once `debounceMs` elapses with no further input.
      clearTimer();
      timerId = setTimeout(() => {
        timerId = null;
        schedulerRef.current.schedule('edit');
      }, debounceMs);
    };

    container.addEventListener('input', handleInput);
    return () => {
      container.removeEventListener('input', handleInput);
      clearTimer();
    };
  }, [enabled, debounceMs]);

  return containerRef;
}
