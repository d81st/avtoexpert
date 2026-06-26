import { act, cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { type ReactElement, useEffect } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldError, useIsolatedField } from '@/features/reports/hooks/useIsolatedField';

/**
 * Property 2: Async validator does not overwrite user input.
 *
 * For any sequence of N user keystrokes interleaved with an Async_Field_Validator
 * whose promise resolves at an arbitrary point during or after the sequence, the
 * final DOM `value` of the Form_Input_Field MUST equal the concatenation of the
 * typed keys (i.e. the user's intended input), and the field MUST NOT be
 * `disabled` or `readonly` at any point in the sequence.
 *
 * **Validates: Requirements 1.6, 1.10**
 *
 * Target: `useIsolatedField` + `FieldError` (single-field useFormState
 * subscription) pattern from task 13.1. The async validator is modeled as a
 * sibling component that subscribes to the watched field value through
 * `useWatch` and, after a configurable delay, calls `setError` or
 * `clearErrors`. This mirrors the design rule that validator results write to a
 * localized `<FieldError name={name}/>` selector — never to the input's render
 * path — so a late-arriving validator resolution must never reset the user's
 * typed value.
 */

type Form = { field: string } & Record<string, unknown>;

/** Single isolated input + its scoped error display. */
function IsolatedFieldHarness(): ReactElement {
  const field = useIsolatedField<Form>('field');
  return (
    <>
      <input aria-label="field" data-testid="field" {...field} />
      <FieldError name="field" />
    </>
  );
}

/**
 * Models an Async_Field_Validator: re-arms a `setTimeout` on every change of the
 * watched field value; when the timer elapses, the validator resolves and writes
 * its result to react-hook-form error state via `setError` / `clearErrors`. The
 * component renders nothing — error display is delegated to the sibling
 * `<FieldError>` (i.e. a `useFormState({ control, name })` selector).
 */
function AsyncValidator({
  delay,
  failureMessage,
}: {
  delay: number;
  failureMessage: string | null;
}): null {
  const { setError, clearErrors, control } = useFormContext<Form>();
  const value = useWatch({ control, name: 'field' });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (failureMessage === null) {
        clearErrors('field');
      } else {
        setError('field', { type: 'async', message: failureMessage });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay, failureMessage, setError, clearErrors]);

  return null;
}

function ScenarioRoot({
  delay,
  failureMessage,
}: {
  delay: number;
  failureMessage: string | null;
}): ReactElement {
  const methods = useForm<Form>({ defaultValues: { field: '' } });
  return (
    <FormProvider {...methods}>
      <IsolatedFieldHarness />
      <AsyncValidator delay={delay} failureMessage={failureMessage} />
    </FormProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Drain any pending validator timers before swapping clocks back so that no
  // microtask escapes into the next iteration.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Property 2: Async validator does not overwrite user input', () => {
  it('final input.value equals the concatenation of typed keys for any keystroke/validator interleaving', () => {
    // A small, deterministic keystroke alphabet covering letters, digits and a
    // few separator characters that are safe for an HTML text input.
    const charArb = fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyz0123456789 -_'.split(''),
    );

    type TypeEvent = { kind: 'type'; char: string };
    type WaitEvent = { kind: 'wait'; ms: number };
    type Event = TypeEvent | WaitEvent;

    const typeEventArb: fc.Arbitrary<Event> = fc.record({
      kind: fc.constant('type' as const),
      char: charArb,
    });
    const waitEventArb: fc.Arbitrary<Event> = fc.record({
      kind: fc.constant('wait' as const),
      ms: fc.integer({ min: 1, max: 400 }),
    });
    const eventArb: fc.Arbitrary<Event> = fc.oneof(typeEventArb, waitEventArb);

    const scenarioArb = fc.record({
      events: fc.array(eventArb, { minLength: 1, maxLength: 25 }),
      validatorDelay: fc.integer({ min: 5, max: 200 }),
      failureMessage: fc.option(
        fc.constantFrom('network timeout', 'invalid', 'server unreachable'),
        { nil: null },
      ),
    });

    fc.assert(
      fc.property(scenarioArb, ({ events, validatorDelay, failureMessage }) => {
        const view = render(
          <ScenarioRoot delay={validatorDelay} failureMessage={failureMessage} />,
        );
        const input = view.getByTestId('field') as HTMLInputElement;

        try {
          let typed = '';
          for (const event of events) {
            if (event.kind === 'type') {
              typed += event.char;
              act(() => {
                // Mirror an uncontrolled keystroke: update the DOM value, then
                // dispatch the `input` event so react-hook-form's `register`
                // onChange handler reads the new value via e.target.value.
                input.value = typed;
                fireEvent.input(input);
              });
            } else {
              act(() => {
                vi.advanceTimersByTime(event.ms);
              });
            }
            // The field is never gated by `disabled` / `readonly` at any point.
            expect(input.disabled).toBe(false);
            expect(input.readOnly).toBe(false);
          }

          // Force any still-pending validator promise to resolve so we observe
          // the worst case where validation lands AFTER the last keystroke.
          act(() => {
            vi.advanceTimersByTime(validatorDelay + 1);
            vi.runOnlyPendingTimers();
          });

          expect(input.disabled).toBe(false);
          expect(input.readOnly).toBe(false);
          // Core property: the user's typed string survives every validator
          // resolution that interleaved with (or followed) the keystrokes.
          expect(input.value).toBe(typed);
        } finally {
          view.unmount();
        }
      }),
      { numRuns: 40 },
    );
  });
});
