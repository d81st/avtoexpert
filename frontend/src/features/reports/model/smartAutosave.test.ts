import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldId } from './dirtyFieldTracker';
import {
  AUTOSAVE_COALESCE_MS,
  type AutosavePayload,
  createSmartAutosave,
  type DirtyTrackerLike,
  getNestedValue,
  type SmartAutosaveConfig,
} from './smartAutosave';

/** Deferred promise helper so a test can settle a request on demand. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Minimal in-memory Dirty_Field_Tracker stub honouring the markSaved oracle. */
function makeTracker(initial: Iterable<FieldId> = []): DirtyTrackerLike & {
  set: Set<FieldId>;
} {
  const set = new Set<FieldId>(initial);
  return {
    set,
    snapshot: () => set,
    beginInFlight: () => new Set(set),
    markSaved: (sent, post) => {
      for (const id of sent) {
        if (!post.has(id)) {
          set.delete(id);
        }
      }
    },
    rollback: () => {
      /* tracker unchanged on error */
    },
  };
}

interface HarnessOptions extends Partial<SmartAutosaveConfig> {
  reportId?: string | null;
  currentStep?: number;
  values?: Record<string, unknown>;
  tracker?: DirtyTrackerLike;
}

function makeConfig(opts: HarnessOptions = {}): SmartAutosaveConfig {
  return {
    getReportId: () => (opts.reportId === undefined ? 'r1' : opts.reportId),
    getCurrentStep: () => opts.currentStep ?? 2,
    getValues: () => opts.values ?? {},
    getVersion: opts.getVersion,
    save: opts.save,
    tracker: opts.tracker ?? makeTracker(['car_model']),
    onSuccess: opts.onSuccess,
    onError: opts.onError,
    onConflict: opts.onConflict,
    coalesceMs: opts.coalesceMs,
    requestTimeoutMs: opts.requestTimeoutMs,
    eligibleSteps: opts.eligibleSteps,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getNestedValue', () => {
  it('resolves nested object + array dot-paths', () => {
    const source = { car_model: 'Lada', repair_works: [{ price: 10 }, { price: 20 }] };
    expect(getNestedValue(source, 'car_model')).toBe('Lada');
    expect(getNestedValue(source, 'repair_works.1.price')).toBe(20);
  });

  it('returns undefined for missing segments', () => {
    expect(getNestedValue({ a: { b: 1 } }, 'a.c')).toBeUndefined();
    expect(getNestedValue({}, 'x.y.z')).toBeUndefined();
  });
});

describe('SmartAutosaveCoordinator.buildPayload (AC 2.2)', () => {
  it('contains exactly reportId plus dirty fields', () => {
    const tracker = makeTracker(['car_model', 'analog1_price']);
    const coordinator = createSmartAutosave(
      makeConfig({
        tracker,
        values: { car_model: 'Lada', analog1_price: 500, untouched: 'x' },
      }),
    );

    const payload = coordinator.buildPayload();
    expect(payload).toEqual({ reportId: 'r1', car_model: 'Lada', analog1_price: 500 });
    expect(payload).not.toHaveProperty('untouched');
  });

  it('includes version when the host provides a numeric one', () => {
    const coordinator = createSmartAutosave(
      makeConfig({
        tracker: makeTracker(['car_model']),
        values: { car_model: 'Lada' },
        getVersion: () => 7,
      }),
    );
    expect(coordinator.buildPayload()).toEqual({ reportId: 'r1', version: 7, car_model: 'Lada' });
  });
});

describe('SmartAutosaveCoordinator.schedule activation guard (AC 2.11)', () => {
  it.each([
    ['null reportId', { reportId: null }],
    ['empty reportId', { reportId: '' }],
    ['step 1 (ineligible)', { currentStep: 1 }],
    ['step 5 (ineligible)', { currentStep: 5 }],
  ])('does not dispatch for %s', (_label, override) => {
    const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
    const coordinator = createSmartAutosave(
      makeConfig({ ...override, tracker: makeTracker(['car_model']), save }),
    );
    coordinator.schedule('edit');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not dispatch when the tracker is empty (AC 2.3)', () => {
    const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
    const coordinator = createSmartAutosave(makeConfig({ tracker: makeTracker([]), save }));
    coordinator.schedule('backstop');
    expect(save).not.toHaveBeenCalled();
  });
});

describe('SmartAutosaveCoordinator request dispatch (AC 2.6)', () => {
  it('calls save with the payload and background flag', async () => {
    const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
    const tracker = makeTracker(['car_model']);
    const coordinator = createSmartAutosave(
      makeConfig({ tracker, save, values: { car_model: 'Lada' } }),
    );

    coordinator.schedule('blur');
    expect(save).toHaveBeenCalledTimes(1);
    const [reportId, payload, options] = save.mock.calls[0] as [
      string,
      AutosavePayload,
      { background: true; signal: AbortSignal },
    ];
    expect(reportId).toBe('r1');
    expect(payload).toEqual({ reportId: 'r1', car_model: 'Lada' });
    expect(options.background).toBe(true);
    expect(options.signal).toBeInstanceOf(AbortSignal);

    await vi.runAllTimersAsync();
    // 2xx cleared the sent field from the tracker.
    expect(tracker.set.has('car_model')).toBe(false);
  });
});

describe('SmartAutosaveCoordinator in-flight singleton + coalescing (AC 2.7)', () => {
  it('does not start a parallel request while one is in flight', () => {
    const gate = deferred();
    const save = vi.fn().mockReturnValue(gate.promise);
    const coordinator = createSmartAutosave(
      makeConfig({ tracker: makeTracker(['car_model']), save }),
    );

    coordinator.schedule('edit');
    coordinator.schedule('edit');
    coordinator.schedule('blur');

    expect(save).toHaveBeenCalledTimes(1);
    gate.resolve({ saved_at: 'now' });
  });

  it('coalesces concurrent triggers into a single follow-up within the coalesce window', async () => {
    const gate1 = deferred();
    const save = vi.fn().mockReturnValueOnce(gate1.promise).mockResolvedValue({ saved_at: 'now' });
    // Tracker stays dirty so the coalesced follow-up has work to send.
    const tracker = makeTracker(['car_model']);
    tracker.markSaved = () => {
      /* keep dirty across saves to exercise the follow-up */
    };
    const coordinator = createSmartAutosave(makeConfig({ tracker, save }));

    coordinator.schedule('edit'); // dispatches request #1
    coordinator.schedule('edit'); // coalesced
    coordinator.schedule('blur'); // coalesced
    expect(save).toHaveBeenCalledTimes(1);

    // Settle request #1, then advance through the coalesce gap.
    gate1.resolve({ saved_at: 'now' });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_COALESCE_MS);

    expect(save).toHaveBeenCalledTimes(2);
  });

  it('does not schedule a follow-up when no trigger fired during the request', async () => {
    const save = vi.fn().mockResolvedValue({ saved_at: 'now' });
    const tracker = makeTracker(['car_model']);
    tracker.markSaved = () => {
      /* keep dirty to prove the absence of a follow-up is about coalescing */
    };
    const coordinator = createSmartAutosave(makeConfig({ tracker, save }));

    coordinator.schedule('edit');
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('SmartAutosaveCoordinator error handling', () => {
  it('routes a 409 to onConflict and leaves the tracker unchanged', async () => {
    const onConflict = vi.fn();
    const onError = vi.fn();
    const tracker = makeTracker(['car_model']);
    const save = vi.fn().mockRejectedValue({ response: { status: 409 } });
    const coordinator = createSmartAutosave(makeConfig({ tracker, save, onConflict, onError }));

    coordinator.schedule('edit');
    await vi.runAllTimersAsync();

    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(tracker.set.has('car_model')).toBe(true);
  });

  it('routes other failures to onError and leaves the tracker unchanged', async () => {
    const onConflict = vi.fn();
    const onError = vi.fn();
    const tracker = makeTracker(['car_model']);
    const save = vi.fn().mockRejectedValue({ response: { status: 500 } });
    const coordinator = createSmartAutosave(makeConfig({ tracker, save, onConflict, onError }));

    coordinator.schedule('edit');
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onConflict).not.toHaveBeenCalled();
    expect(tracker.set.has('car_model')).toBe(true);
  });
});
