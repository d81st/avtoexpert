import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import type { FieldId } from '@/features/reports/model/dirtyFieldTracker';
import {
  type AutosavePayload,
  createSmartAutosave,
  type DirtyTrackerLike,
  getNestedValue,
} from '@/features/reports/model/smartAutosave';

/**
 * Property 5: Autosave_Payload contains exactly reportId plus dirty fields.
 *
 * For any non-empty Dirty_Field_Tracker state D, any reportId R, and any
 * backing form values V, `buildPayload(R, D, V)` MUST produce an object whose
 * key set equals `{reportId} ∪ D` and whose `reportId` value equals R; for any
 * field id f ∈ D, the value at key f in the payload MUST equal
 * `getNestedValue(V, f)`. If D is empty for any trigger source ∈
 * {blur, edit, backstop}, no network request MUST be issued.
 *
 * **Validates: Requirements 2.2, 2.3, 2.10**
 *
 * Property 6: Autosave activation guard.
 *
 * For any (reportId, currentStep) pair where reportId ∈ {null, undefined, ''}
 * or currentStep ∉ {2, 3, 4}, no trigger source ∈ {blur, edit, backstop} MUST
 * cause a `reportService.autosave` invocation, irrespective of
 * Dirty_Field_Tracker contents.
 *
 * **Validates: Requirements 2.11**
 */

/** Smart_Autosave trigger sources (mirrors `AutosaveTrigger`). */
const TRIGGERS = ['blur', 'edit', 'backstop'] as const;

/** Steps that activate the coordinator (AC 2.11 / AC 3.4 of frontend-ux-enhancements). */
const ELIGIBLE_STEPS = [2, 3, 4] as const;

/** Steps that the activation guard must reject. */
const INELIGIBLE_STEPS = [-1, 0, 1, 5, 6, 7, 99] as const;

/**
 * Field-id pool: simple identifiers so the property is a clean oracle (each
 * field id resolves to `values[id]` via {@link getNestedValue}). Re-use of a
 * shared pool also guarantees that an arbitrary subset cannot grow large
 * enough to mask coverage of small-cardinality cases.
 */
const FIELD_POOL: readonly FieldId[] = [
  'car_model',
  'analog1_price',
  'analog2_price',
  'vin_code',
  'license_plate',
  'mileage',
  'owner_name',
] as const;

/** A scalar value generator wide enough to exercise primitive types and `null`. */
const arbScalar = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.double({ noNaN: true }),
  fc.constant(null),
);

/** Minimal Dirty_Field_Tracker stub honouring the {@link DirtyTrackerLike} contract. */
function makeTracker(initial: Iterable<FieldId>): DirtyTrackerLike {
  const set = new Set<FieldId>(initial);
  return {
    snapshot: () => set,
    beginInFlight: () => new Set(set),
    markSaved: () => {
      /* not exercised here */
    },
    rollback: () => {
      /* not exercised here */
    },
  };
}

describe('Property 5: Autosave_Payload contains exactly reportId plus dirty fields', () => {
  it('buildPayload key set equals {reportId} ∪ D and values come from V', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 24 }),
        fc.uniqueArray(fc.constantFrom(...FIELD_POOL)),
        fc.dictionary(fc.constantFrom(...FIELD_POOL), arbScalar),
        fc.constantFrom(...ELIGIBLE_STEPS),
        (reportId, dirtyArr, values, step) => {
          const dirty = new Set<FieldId>(dirtyArr);
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => values,
            tracker: makeTracker(dirty),
          });

          const payload: AutosavePayload = coordinator.buildPayload();

          // Key set equals {reportId} ∪ D.
          const expectedKeys = new Set<string>(['reportId', ...dirty]);
          expect(new Set(Object.keys(payload))).toEqual(expectedKeys);

          // reportId is carried verbatim.
          expect(payload.reportId).toBe(reportId);

          // Each f ∈ D resolves to getNestedValue(V, f).
          for (const f of dirty) {
            expect(payload[f]).toStrictEqual(getNestedValue(values, f));
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('buildPayload includes optional version when the host provides a numeric one', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.uniqueArray(fc.constantFrom(...FIELD_POOL)),
        fc.constantFrom(...ELIGIBLE_STEPS),
        (reportId, version, dirtyArr, step) => {
          const dirty = new Set<FieldId>(dirtyArr);
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => ({}),
            getVersion: () => version,
            tracker: makeTracker(dirty),
          });

          const payload = coordinator.buildPayload();

          expect(payload.version).toBe(version);
          expect(payload.reportId).toBe(reportId);
          expect(new Set(Object.keys(payload))).toEqual(
            new Set<string>(['reportId', 'version', ...dirty]),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not invoke save when the Dirty_Field_Tracker is empty for any trigger (AC 2.3)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.constantFrom(...ELIGIBLE_STEPS),
        fc.constantFrom(...TRIGGERS),
        (reportId, step, trigger) => {
          const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => ({}),
            tracker: makeTracker([]),
            save,
          });

          coordinator.schedule(trigger);

          expect(save).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Property 6: Autosave activation guard', () => {
  /** reportId values that the guard must reject (AC 2.11). */
  const INVALID_REPORT_IDS: ReadonlyArray<string | null | undefined> = [null, undefined, ''];

  it('does not invoke save for invalid reportId regardless of step or trigger', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INVALID_REPORT_IDS),
        // Cover both eligible and ineligible steps — the guard must reject on reportId alone.
        fc.integer({ min: -5, max: 10 }),
        fc.constantFrom(...TRIGGERS),
        fc.uniqueArray(fc.constantFrom(...FIELD_POOL), { minLength: 1 }),
        (reportId, step, trigger, dirtyArr) => {
          const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => ({}),
            tracker: makeTracker(dirtyArr),
            save,
          });

          coordinator.schedule(trigger);

          expect(save).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does not invoke save for ineligible currentStep, even with a non-empty tracker', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.constantFrom(...INELIGIBLE_STEPS),
        fc.constantFrom(...TRIGGERS),
        fc.uniqueArray(fc.constantFrom(...FIELD_POOL), { minLength: 1 }),
        (reportId, step, trigger, dirtyArr) => {
          const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => ({}),
            tracker: makeTracker(dirtyArr),
            save,
          });

          coordinator.schedule(trigger);

          expect(save).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('does invoke save when both guards pass and the tracker is non-empty (positive control)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.constantFrom(...ELIGIBLE_STEPS),
        fc.constantFrom(...TRIGGERS),
        fc.uniqueArray(fc.constantFrom(...FIELD_POOL), { minLength: 1 }),
        (reportId, step, trigger, dirtyArr) => {
          const save = vi.fn().mockReturnValue(new Promise(() => undefined));
          const coordinator = createSmartAutosave({
            getReportId: () => reportId,
            getCurrentStep: () => step,
            getValues: () => ({}),
            tracker: makeTracker(dirtyArr),
            save,
          });

          coordinator.schedule(trigger);

          expect(save).toHaveBeenCalledTimes(1);
          const [calledReportId, payload, options] = save.mock.calls[0] as [
            string,
            AutosavePayload,
            { background: true; signal: AbortSignal },
          ];
          expect(calledReportId).toBe(reportId);
          expect(payload.reportId).toBe(reportId);
          expect(options.background).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
