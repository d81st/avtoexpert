import { type RefObject, useEffect, useRef } from 'react';
import { dirtyFieldTracker, type FieldId } from '../model/dirtyFieldTracker';

/**
 * Field_Blur_Trigger (Requirement 2, AC 2.5).
 *
 * Activates Smart_Autosave when a Form_Input_Field belonging to Wizard steps
 * `step2`/`step3`/`step4` loses focus (`blur`) **and** that field's id is present
 * in the Dirty_Field_Tracker. The scheduler is invoked synchronously inside the
 * `blur` handler, so the dispatch happens immediately — well within the 500 ms
 * SLA mandated by AC 2.5.
 *
 * ## Cross-task dependency on task 14.5 (`smartAutosave.ts`)
 *
 * The Smart_Autosave coordinator (`frontend/src/features/reports/model/smartAutosave.ts`)
 * is implemented by task 14.5 and is **not** created here. To keep this hook
 * decoupled, buildable before 14.5 lands, and unit-testable, the scheduler is
 * injected via {@link UseFieldBlurTriggerOptions.scheduler}. The injected object
 * only needs to satisfy {@link AutosaveScheduler}, whose `schedule('blur')`
 * signature matches the `SmartAutosaveAPI.schedule` contract defined in
 * `design.md` (§3.2). Once 14.5 exports the coordinator singleton, the Wizard
 * wiring (task 14.9) passes it straight into this hook — no change to this file
 * is required because `smartAutosave` already conforms to {@link AutosaveScheduler}.
 */

/** Smart_Autosave trigger source. Mirrors `SmartAutosaveAPI.schedule` (design §3.2). */
export type AutosaveTrigger = 'blur' | 'edit' | 'backstop';

/**
 * Minimal scheduler contract consumed by this hook. The task 14.5
 * `smartAutosave` coordinator structurally satisfies this interface via its
 * `schedule(trigger)` method.
 */
export interface AutosaveScheduler {
  /** Funnel point for all Smart_Autosave triggers. Idempotent under concurrent calls. */
  schedule(trigger: AutosaveTrigger): void;
}

export interface UseFieldBlurTriggerOptions {
  /**
   * Smart_Autosave coordinator (task 14.5). Injected so the hook stays decoupled
   * from the coordinator module and remains testable in isolation.
   */
  scheduler: AutosaveScheduler;
  /**
   * When `false`, no `blur` listener is attached (e.g. the active Wizard step is
   * outside `step2`/`step3`/`step4`). Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Reads the tracked field id from a `blur` event target. Form_Input_Fields
 * registered through react-hook-form carry their dot-path identifier in the
 * native `name` attribute (e.g. `repair_works.2.price`), which matches the
 * {@link FieldId} stored in the Dirty_Field_Tracker.
 */
function resolveFieldId(target: EventTarget | null): FieldId | null {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target.name.length > 0 ? target.name : null;
  }
  if (target instanceof HTMLElement) {
    const name = target.getAttribute('name');
    return name && name.length > 0 ? name : null;
  }
  return null;
}

/**
 * Binds the Field_Blur_Trigger to a Wizard step subtree.
 *
 * Attach the returned ref to the container element wrapping the step's
 * Form_Input_Fields. The hook installs a single capture-phase `blur` listener on
 * that container (the `blur` event does not bubble, so capture is required to
 * observe blurs from any descendant field). On each blur it:
 *
 * 1. resolves the blurred field's id from its `name` attribute,
 * 2. checks membership in `dirtyFieldTracker.snapshot()` (AC 2.5 dirty guard),
 * 3. synchronously calls `scheduler.schedule('blur')` when the field is dirty.
 *
 * @returns A ref to attach to the step container element.
 */
export function useFieldBlurTrigger({
  scheduler,
  enabled = true,
}: UseFieldBlurTriggerOptions): RefObject<HTMLElement | null> {
  const containerRef = useRef<HTMLElement | null>(null);
  // Keep the latest scheduler without re-installing the listener on every render.
  const schedulerRef = useRef(scheduler);
  schedulerRef.current = scheduler;

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) {
      return;
    }

    const handleBlur = (event: FocusEvent): void => {
      const fieldId = resolveFieldId(event.target);
      if (!fieldId) {
        return;
      }
      // AC 2.5 — only dirty fields trigger an autosave on blur.
      if (!dirtyFieldTracker.snapshot().has(fieldId)) {
        return;
      }
      // Synchronous dispatch satisfies the ≤500 ms SLA (AC 2.5). The coordinator
      // (task 14.5) coalesces/guards downstream; this hook only signals intent.
      schedulerRef.current.schedule('blur');
    };

    // `blur` does not bubble — capture phase observes descendant field blurs.
    container.addEventListener('blur', handleBlur, true);
    return () => container.removeEventListener('blur', handleBlur, true);
  }, [enabled]);

  return containerRef;
}
