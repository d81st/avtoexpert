// Feature: platform-improvements-mvp, Property 7: For any trigger sequence drawn
// from {blur, edit, backstop} interleaved with arbitrary settlement timings, the
// Smart_Autosave coordinator MUST keep the in-flight reportService.autosave count
// for one reportId at ≤ 1 AND MUST issue exactly one coalesced follow-up within
// [0, 200] ms of the prior request's settlement provided the Dirty_Field_Tracker
// is non-empty at that moment. Otherwise no follow-up MUST be dispatched.
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FieldId } from '@/features/reports/model/dirtyFieldTracker';
import {
  AUTOSAVE_COALESCE_MS,
  type AutosaveSaveFn,
  createSmartAutosave,
  type DirtyTrackerLike,
  type SmartAutosaveCoordinator,
} from '@/features/reports/model/smartAutosave';
import type { AutosaveTrigger } from '@/features/reports/hooks/useFieldBlurTrigger';

/**
 * Property 7: Autosave concurrency and coalescing invariant.
 *
 * **Validates: Requirements 2.6, 2.7**
 *
 * Model-based property (fc.commands) per design §6. A reference model mirrors
 * the coordinator's busy / pending / dirty state and, after every command, we
 * assert that:
 *   - the observed save invocation count equals the model count
 *     (which encodes "≤ 1 in-flight" and "exactly one coalesced follow-up");
 *   - the runtime in-flight counter (mock save's bookkeeping) never exceeds 1;
 *   - when the model says no follow-up is owed (because pending=false or the
 *     tracker became empty at settlement), the real coordinator stays idle
 *     after the coalesce window.
 *
 * Vitest fake timers freeze wall time; the only time advance the test issues is
 * a single `AUTOSAVE_COALESCE_MS` tick at the end of each Settle command, which
 * exercises the coordinator's coalesce timer without ever crossing the 30 s
 * abort threshold.
 */

// ---- Test doubles ----------------------------------------------------------

interface Deferred {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

function makeDeferred(): Deferred {
  let resolve!: (value: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Mutable Dirty_Field_Tracker stub. Exposes the {@link DirtyTrackerLike}
 * surface the coordinator depends on plus an {@link add} helper the property's
 * AddDirtyField command uses to grow the dirty set mid-test.
 */
interface MutableTracker extends DirtyTrackerLike {
  add(id: FieldId): void;
}

function makeTracker(initial: Iterable<FieldId> = []): MutableTracker {
  const set = new Set<FieldId>(initial);
  return {
    add: (id) => {
      set.add(id);
    },
    snapshot: () => set,
    beginInFlight: () => new Set(set),
    markSaved: (sent, post) => {
      // Mirror dirtyFieldTracker.markSaved: drop ids that were sent AND not
      // re-dirtied during the in-flight window. The Settle commands always pass
      // an empty `post`, so every sent id is cleared (the realistic 2xx path).
      for (const id of sent) {
        if (!post.has(id)) {
          set.delete(id);
        }
      }
    },
    rollback: () => {
      /* tracker unchanged on error / 409 — matches dirtyFieldTracker.rollback */
    },
  };
}

/** Runtime ("real") state observed by the model after each command. */
interface Real {
  coordinator: SmartAutosaveCoordinator;
  tracker: MutableTracker;
  /** Outstanding deferreds; head is the currently in-flight one (length ≤ 1). */
  queue: Deferred[];
  /** Total invocations of save() since Real construction. */
  saveCalls: number;
  /** Current in-flight count (incremented in save, decremented when the wrapping promise settles). */
  inFlight: number;
}

function makeReal(initialDirty: readonly FieldId[]): Real {
  const tracker = makeTracker(initialDirty);
  const queue: Deferred[] = [];
  const real: Real = {
    coordinator: null as unknown as SmartAutosaveCoordinator,
    tracker,
    queue,
    saveCalls: 0,
    inFlight: 0,
  };

  const save: AutosaveSaveFn = (_reportId, _payload, options) => {
    real.saveCalls += 1;
    real.inFlight += 1;
    const d = makeDeferred();
    queue.push(d);
    // Honour the coordinator's 30 s abort if the test ever advances that far.
    // The Settle commands only advance AUTOSAVE_COALESCE_MS, so this listener
    // is a safety net rather than a code path the property exercises.
    options.signal.addEventListener('abort', () => {
      d.reject(new Error('aborted'));
    });
    return d.promise.finally(() => {
      real.inFlight -= 1;
    });
  };

  real.coordinator = createSmartAutosave({
    getReportId: () => 'r1',
    getCurrentStep: () => 2,
    getValues: () => ({}),
    save,
    tracker,
  });
  return real;
}

// ---- Reference model -------------------------------------------------------

interface Model {
  /** True while a request is in flight OR within the post-settle coalesce gap. */
  busy: boolean;
  /** A trigger fired during {@link busy}; coalesced into one follow-up. */
  pending: boolean;
  /** Mirror of the tracker's dirty set. */
  dirty: Set<FieldId>;
  /** Snapshot the coordinator captured at dispatch; null when no request is in flight. */
  sentInFlight: Set<FieldId> | null;
  /** Total save invocations the coordinator should have issued so far. */
  savesExpected: number;
}

// Drain enough microtask ticks for the coordinator's
// .then → .catch → .finally(settled) chain to run after a deferred settles.
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}

// ---- Commands --------------------------------------------------------------

class ScheduleCommand implements fc.AsyncCommand<Model, Real> {
  constructor(private readonly trigger: AutosaveTrigger) {}

  check(_m: Readonly<Model>): boolean {
    return true;
  }

  async run(m: Model, r: Real): Promise<void> {
    r.coordinator.schedule(this.trigger);

    // Mirror coordinator.schedule semantics (AC 2.3, 2.7, 2.11):
    //   - empty tracker → no-op;
    //   - idle + dirty → dispatch synchronously;
    //   - busy + dirty → set pending flag (coalesced into one follow-up).
    if (!m.busy && m.dirty.size > 0) {
      m.busy = true;
      m.pending = false;
      m.sentInFlight = new Set(m.dirty);
      m.savesExpected += 1;
    } else if (m.busy && m.dirty.size > 0) {
      m.pending = true;
    }

    expect(r.inFlight).toBeLessThanOrEqual(1);
    expect(r.saveCalls).toBe(m.savesExpected);
    expect(r.inFlight).toBe(m.sentInFlight === null ? 0 : 1);
  }

  toString(): string {
    return `schedule(${this.trigger})`;
  }
}

class AddDirtyFieldCommand implements fc.AsyncCommand<Model, Real> {
  constructor(private readonly id: FieldId) {}

  check(_m: Readonly<Model>): boolean {
    return true;
  }

  async run(m: Model, r: Real): Promise<void> {
    // External edit grows the dirty set without scheduling. The coordinator
    // never reads the tracker except inside schedule()/dispatch(), so this
    // command must NOT change busy / pending / savesExpected.
    r.tracker.add(this.id);
    m.dirty.add(this.id);

    expect(r.inFlight).toBeLessThanOrEqual(1);
    expect(r.saveCalls).toBe(m.savesExpected);
  }

  toString(): string {
    return `addDirty(${this.id})`;
  }
}

class SettleSuccessCommand implements fc.AsyncCommand<Model, Real> {
  /** Only valid while a request is in flight (queue non-empty). */
  check(m: Readonly<Model>): boolean {
    return m.sentInFlight !== null;
  }

  async run(m: Model, r: Real): Promise<void> {
    const d = r.queue.shift();
    expect(d).toBeDefined();
    (d as Deferred).resolve({ saved_at: 'now' });

    // Drain microtasks so the coordinator's .then(success) / .finally(settled)
    // run and the coalesce setTimeout is registered.
    await flushMicrotasks();

    // Model: markSaved(sent, post=∅) clears every sent id from the dirty set.
    const sent = m.sentInFlight as Set<FieldId>;
    for (const id of sent) {
      m.dirty.delete(id);
    }
    m.sentInFlight = null;

    // Advance past the coalesce window. If pending && dirty.size > 0 the
    // coordinator dispatches the follow-up inside this tick.
    await vi.advanceTimersByTimeAsync(AUTOSAVE_COALESCE_MS);

    if (m.pending && m.dirty.size > 0) {
      m.sentInFlight = new Set(m.dirty);
      m.savesExpected += 1;
      m.pending = false;
      // busy stays true: follow-up is now in flight.
    } else {
      m.busy = false;
      m.pending = false;
    }

    // Drain post-dispatch microtasks (the follow-up's chain rewires settled).
    await flushMicrotasks();

    expect(r.inFlight).toBeLessThanOrEqual(1);
    expect(r.saveCalls).toBe(m.savesExpected);
    expect(r.inFlight).toBe(m.sentInFlight === null ? 0 : 1);
  }

  toString(): string {
    return 'settleSuccess';
  }
}

class SettleErrorCommand implements fc.AsyncCommand<Model, Real> {
  check(m: Readonly<Model>): boolean {
    return m.sentInFlight !== null;
  }

  async run(m: Model, r: Real): Promise<void> {
    const d = r.queue.shift();
    expect(d).toBeDefined();
    (d as Deferred).reject(new Error('boom'));

    await flushMicrotasks();

    // rollback() leaves the dirty set unchanged.
    m.sentInFlight = null;
    await vi.advanceTimersByTimeAsync(AUTOSAVE_COALESCE_MS);

    if (m.pending && m.dirty.size > 0) {
      m.sentInFlight = new Set(m.dirty);
      m.savesExpected += 1;
      m.pending = false;
    } else {
      m.busy = false;
      m.pending = false;
    }

    await flushMicrotasks();

    expect(r.inFlight).toBeLessThanOrEqual(1);
    expect(r.saveCalls).toBe(m.savesExpected);
    expect(r.inFlight).toBe(m.sentInFlight === null ? 0 : 1);
  }

  toString(): string {
    return 'settleError';
  }
}

// ---- Property --------------------------------------------------------------

describe('Property 7: Autosave concurrency and coalescing invariant', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Drain any pending coalesce / abort timers so vi.useRealTimers does not
    // leave dangling listeners across tests.
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('coordinator state matches the oracle across random trigger/settle sequences', async () => {
    const triggerArb: fc.Arbitrary<AutosaveTrigger> = fc.constantFrom('blur', 'edit', 'backstop');
    const fieldArb: fc.Arbitrary<FieldId> = fc.constantFrom('f0', 'f1', 'f2', 'f3');

    const commandsArb = fc.commands(
      [
        triggerArb.map((t) => new ScheduleCommand(t)),
        fieldArb.map((id) => new AddDirtyFieldCommand(id)),
        fc.constant(new SettleSuccessCommand()),
        fc.constant(new SettleErrorCommand()),
      ],
      { maxCommands: 30 },
    );

    await fc.assert(
      fc.asyncProperty(commandsArb, async (cmds) => {
        // Fresh fake-timer clock + fresh coordinator per run.
        vi.clearAllTimers();
        vi.setSystemTime(0);

        const real = makeReal(['f0']);
        const model: Model = {
          busy: false,
          pending: false,
          dirty: new Set<FieldId>(['f0']),
          sentInFlight: null,
          savesExpected: 0,
        };

        await fc.asyncModelRun(() => ({ model, real }), cmds);

        // Cleanup: settle anything left in flight + drain the coalesce window
        // so the next run starts from a quiescent timer queue.
        while (real.queue.length > 0) {
          const d = real.queue.shift();
          (d as Deferred).resolve({ saved_at: 'cleanup' });
          await flushMicrotasks();
          await vi.advanceTimersByTimeAsync(AUTOSAVE_COALESCE_MS);
          await flushMicrotasks();
        }
        real.coordinator.reset();
      }),
      { numRuns: 200, verbose: true },
    );
  });
});
