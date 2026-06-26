// Feature: platform-improvements-mvp, Property 1: For any Managed_Form composed
// of N ∈ [2, 20] Form_Input_Field instances and for any field index k where the
// user types a keystroke, the React render count of every field j ≠ k that is
// not explicitly subscribed to field k's value via `useWatch` or `Controller`
// MUST remain unchanged from the count prior to the keystroke.
//
// **Validates: Requirements 1.3, 1.7, 1.9**

import { cleanup, fireEvent, render } from '@testing-library/react';
import fc from 'fast-check';
import { memo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsolatedField } from '@/features/reports/hooks/useIsolatedField';

/**
 * Render counter array shared between the test harness and the assertion code.
 *
 * Each entry is incremented every time the corresponding `<CountedField/>`
 * commits a render, which makes the array the equivalent of the `<RenderCounter/>`
 * HOC fixed in design §"Coverage targets" for Property 1.
 *
 * The array is reset in `beforeEach` and resized at the start of every property
 * iteration via {@link resetCounts}.
 */
const renderCounts: number[] = [];

function resetCounts(n: number): void {
  renderCounts.length = 0;
  for (let i = 0; i < n; i += 1) {
    renderCounts.push(0);
  }
}

/**
 * A single `useIsolatedField`-driven input wrapped in `memo` so React only
 * re-renders it when its own props or its parent context forces a re-render.
 *
 * Incrementing `renderCounts[index]` inside the render body is the
 * `<RenderCounter/>` HOC — every commit bumps the counter by one. The field
 * never reads from a root-level `watch()` or `useFormState()` (those are scoped
 * inside `<FieldError/>`, which is not mounted here), so on a keystroke React
 * only re-renders the input whose value changed at the DOM level — the
 * uncontrolled `register` path of react-hook-form does not trigger a parent
 * `setState`.
 */
const CountedField = memo(function CountedField({
  index,
  name,
}: {
  index: number;
  name: string;
}) {
  renderCounts[index] = (renderCounts[index] ?? 0) + 1;
  const field = useIsolatedField(name);
  return <input data-testid={`field-${index}`} {...field} />;
});

/**
 * Minimal representative Managed_Form harness — a single `<FormProvider/>`
 * mounting `n` isolated fields side-by-side. This is the loop body of the
 * property: it stands in for the Wizard's active Step subtree (R1.7) where only
 * one Step is mounted at a time, and it covers the sibling-field case for
 * R1.3 / R1.9 across an arbitrary fan-out of 2…20 fields.
 */
function FormHarness({ n }: { n: number }): JSX.Element {
  const defaults: Record<string, string> = {};
  for (let i = 0; i < n; i += 1) {
    defaults[`f${i}`] = '';
  }
  const methods = useForm<Record<string, string>>({ defaultValues: defaults });
  return (
    <FormProvider {...methods}>
      <form>
        {Array.from({ length: n }, (_, i) => (
          <CountedField key={i} index={i} name={`f${i}`} />
        ))}
      </form>
    </FormProvider>
  );
}

describe('Property 1: Rendering isolation under field change', () => {
  beforeEach(() => {
    // Per design §"Coverage targets": Property 1 uses `vi.useFakeTimers()` so
    // any incidental debounced / async work inside RHF stays deterministic and
    // does not flush a stray render between assertions.
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('typing a key into one field never re-renders sibling fields', () => {
    const keyArb = fc.constantFrom('a', 'b', 'c', '1', '2', ' ', '.', '-');

    const inputArb = fc
      .integer({ min: 2, max: 20 })
      .chain((n) =>
        fc.tuple(
          fc.constant(n),
          fc.array(
            fc.record({
              field: fc.integer({ min: 0, max: n - 1 }),
              key: keyArb,
            }),
            { minLength: 1, maxLength: 30 },
          ),
        ),
      );

    fc.assert(
      fc.property(inputArb, ([n, actions]) => {
        resetCounts(n);
        const { container, unmount } = render(<FormHarness n={n} />);

        try {
          // Initial mount commit: each `<CountedField/>` is rendered exactly
          // once. If a field rendered more than once on mount, sibling
          // isolation would already be broken before any keystroke.
          for (let i = 0; i < n; i += 1) {
            expect(renderCounts[i]).toBe(1);
          }

          let accumulated = '';
          let lastField = -1;

          for (const { field, key } of actions) {
            // Snapshot every counter before the keystroke; the property asserts
            // that every counter at index j ≠ field is byte-equal afterwards.
            const before = renderCounts.slice();

            // Reset the typed value buffer whenever the property switches the
            // target field, so we never feed RHF a value already owned by a
            // different field.
            if (field !== lastField) {
              accumulated = '';
              lastField = field;
            }
            accumulated += key;

            const input = container.querySelector(
              `[data-testid="field-${field}"]`,
            ) as HTMLInputElement;
            expect(input).not.toBeNull();

            // `fireEvent.change` sets the DOM value and dispatches the native
            // change event, which is what RHF's uncontrolled `register` listens
            // to. This is the closest analogue to a real keystroke for an
            // uncontrolled input.
            fireEvent.change(input, { target: { value: accumulated } });

            // R1.3 / R1.9: render count of every sibling is unchanged.
            for (let j = 0; j < n; j += 1) {
              if (j !== field) {
                expect(renderCounts[j]).toBe(before[j]);
              }
            }
          }
        } finally {
          unmount();
        }
      }),
      { numRuns: 100, verbose: true },
    );
  });
});
