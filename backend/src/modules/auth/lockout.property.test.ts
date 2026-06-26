// Feature: remove-audit-subsystem
// Property 1: Gate threshold
//   isLocked(key, now) <=> windowCount(key, now) >= LOCKOUT_THRESHOLD
//   where windowCount is computed over `auth_failures` only.
//
// Property 2: Counter reset on success
//   Immediately after recordSuccess(key), the next isLocked(key, now) returns
//   false until at least LOCKOUT_THRESHOLD further failures accumulate for
//   that key within LOCKOUT_WINDOW_MS.
//
// Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.1, 6.2
//
// This is a model-based property test. The Postgres-backed `auth_failures`
// access is replaced by an in-memory store whose query semantics faithfully
// reproduce the design SQL (sliding `(cutoff, now]` window keyed by
// `client_ip OR email`). An independent reference model — implemented over
// plain arrays rather than SQL — predicts lock state and the real service is
// driven in lockstep against it.

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

// --- Shared in-memory store (hoisted so the mock factories can close over it)

const h = vi.hoisted(() => {
  // Column descriptors. Identity is what the fake db uses to pick a table;
  // `.f` is the row field the predicate helpers read.
  const cols = {
    authFailures: {
      clientIp: { f: 'clientIp' },
      email: { f: 'email' },
      createdAt: { f: 'createdAt' },
    },
  };

  interface Pred {
    kind: 'eq' | 'gt' | 'or' | 'and';
    f?: string;
    val?: unknown;
    args?: Pred[];
  }

  function evalPred(pred: Pred, row: Record<string, unknown>): boolean {
    switch (pred.kind) {
      case 'eq':
        return row[pred.f as string] === pred.val;
      case 'gt':
        return (
          (row[pred.f as string] as number | Date) >
          (pred.val as number | Date)
        );
      case 'or':
        return (pred.args ?? []).some((a) => evalPred(a, row));
      case 'and':
        return (pred.args ?? []).every((a) => evalPred(a, row));
      default:
        return false;
    }
  }

  const store = {
    authFailures: [] as Record<string, unknown>[],
    reset() {
      store.authFailures.length = 0;
    },
  };

  function tableArr(_table: unknown): Record<string, unknown>[] {
    // Only `auth_failures` is exposed to the lockout service after the audit
    // subsystem retirement; any other table identity would be a bug.
    return store.authFailures;
  }

  const fakeDb = {
    insert(table: unknown) {
      return {
        values(row: Record<string, unknown>) {
          tableArr(table).push({ ...row });
          return Promise.resolve([{}]);
        },
      };
    },
    select(_sel: unknown) {
      return {
        from(table: unknown) {
          const arr = tableArr(table);
          return {
            where(cond: Pred) {
              const value = arr.filter((r) => evalPred(cond, r)).length;
              return Promise.resolve([{ value }]);
            },
          };
        },
      };
    },
    delete(table: unknown) {
      return {
        where(cond: Pred) {
          const arr = tableArr(table);
          for (let i = arr.length - 1; i >= 0; i--) {
            if (evalPred(cond, arr[i] as Record<string, unknown>)) {
              arr.splice(i, 1);
            }
          }
          return Promise.resolve();
        },
      };
    },
  };

  return { cols, store, fakeDb };
});

// drizzle-orm helpers are replaced with descriptor builders the fake db reads.
vi.mock('drizzle-orm', () => ({
  eq: (col: { f: string }, val: unknown) => ({ kind: 'eq', f: col.f, val }),
  gt: (col: { f: string }, val: unknown) => ({ kind: 'gt', f: col.f, val }),
  or: (...args: unknown[]) => ({ kind: 'or', args }),
  and: (...args: unknown[]) => ({ kind: 'and', args }),
  count: () => ({ __count: true }),
}));

vi.mock('../../db/index.js', () => ({ db: h.fakeDb }));
vi.mock('../../db/schema.js', () => ({
  authFailures: h.cols.authFailures,
}));

// The lockout service emits structured `auth_lockout` log lines via the shared
// winston logger. Stub the transport so the property runs don't write log
// files; assertions on the logger's call shape live in a dedicated canary
// (task 6.3) — this suite only validates the gate contract.
vi.mock('../../shared/logger/logger.js', () => ({
  logger: {
    warn: () => undefined,
    info: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  },
}));

import {
  LOCKOUT_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  type LockoutKey,
  lockoutService,
} from './lockout.service.js';

// --- Key pool ----------------------------------------------------------------
//
// Designed so the Lockout_Key generator can produce both required variations:
//   * POOL[0] vs POOL[1] differ only by `client_ip` (same email)
//   * POOL[0] vs POOL[2] differ only by `email` (same client_ip)
//
// POOL[3] exercises the email-undefined branch of the predicate (IP-only).

const KEY_POOL: readonly LockoutKey[] = [
  { clientIp: '203.0.113.1', email: 'a@example.com' },
  { clientIp: '203.0.113.2', email: 'a@example.com' },
  { clientIp: '203.0.113.1', email: 'b@example.com' },
  { clientIp: '203.0.113.3', email: undefined },
];

// --- Reference model (independent of the service's SQL implementation) -------
//
// Tracks only failure timestamps (no `events` array, no per-window dedup
// expectation). `windowCount` is computed over `auth_failures` only and uses
// the same `(client_ip OR email) AND createdAt > now − LOCKOUT_WINDOW_MS`
// predicate as the service, with a strict (`>`) lower bound.

interface FailureEntry {
  clientIp: string;
  email: string | null;
  t: number;
}

class LockoutModel {
  private failures: FailureEntry[] = [];

  private matchesKey(entry: FailureEntry, key: LockoutKey): boolean {
    if (key.email) {
      return entry.clientIp === key.clientIp || entry.email === key.email;
    }
    return entry.clientIp === key.clientIp;
  }

  windowCount(key: LockoutKey, t: number): number {
    return this.failures.filter(
      (f) => this.matchesKey(f, key) && f.t > t - LOCKOUT_WINDOW_MS,
    ).length;
  }

  isLocked(key: LockoutKey, t: number): boolean {
    return this.windowCount(key, t) >= LOCKOUT_THRESHOLD;
  }

  recordFailure(key: LockoutKey, t: number): void {
    this.failures.push({
      clientIp: key.clientIp,
      email: key.email ?? null,
      t,
    });
  }

  recordSuccess(key: LockoutKey): void {
    this.failures = this.failures.filter((f) => !this.matchesKey(f, key));
  }
}

// --- Generators --------------------------------------------------------------

type Op = {
  kind: 'fail' | 'success' | 'check';
  deltaMs: number;
  keyIdx: number;
};

const opArb: fc.Arbitrary<Op> = fc.record({
  kind: fc.constantFrom('fail', 'success', 'check') as fc.Arbitrary<Op['kind']>,
  // Advance between 0 and 25 minutes so sequences straddle the 15-min window.
  deltaMs: fc.integer({ min: 0, max: 25 * 60 * 1000 }),
  keyIdx: fc.integer({ min: 0, max: KEY_POOL.length - 1 }),
});

const sequenceArb = fc.array(opArb, { minLength: 1, maxLength: 40 });

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

// --- Property test -----------------------------------------------------------

describe('Lockout gate properties (R1.1, R1.2, R1.3, R1.5, R6.1, R6.2)', () => {
  it('isLocked matches windowCount >= threshold and recordSuccess resets the gate', async () => {
    await fc.assert(
      fc.asyncProperty(sequenceArb, async (ops) => {
        h.store.reset();
        const model = new LockoutModel();
        let clock = T0;

        for (const op of ops) {
          clock += op.deltaMs;
          const now = new Date(clock);
          const key = KEY_POOL[op.keyIdx];

          if (op.kind === 'fail') {
            model.recordFailure(key, clock);
            await lockoutService.recordFailure(key, now);
            // (a) Post-fail: gate state tracks `windowCount >= THRESHOLD`.
            //     Failures outside the window do not contribute, since both
            //     model and service use the same strict `>` lower bound at
            //     `now − LOCKOUT_WINDOW_MS`.
            const actual = await lockoutService.isLocked(key, now);
            const expected =
              model.windowCount(key, clock) >= LOCKOUT_THRESHOLD;
            expect(actual).toBe(expected);
          } else if (op.kind === 'success') {
            model.recordSuccess(key);
            await lockoutService.recordSuccess(key);
            // (b) Immediately after recordSuccess, isLocked is false for the
            //     same key — the counter has been cleared, so windowCount is
            //     zero and the threshold cannot be met.
            const actual = await lockoutService.isLocked(key, now);
            expect(actual).toBe(false);
          } else {
            // (a)+(c) On check, `isLocked <=> windowCount >= THRESHOLD`,
            //         which implicitly validates that failures older than
            //         one window do not contribute to the count.
            const expected = model.isLocked(key, clock);
            const actual = await lockoutService.isLocked(key, now);
            expect(actual).toBe(expected);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});

// --- Unit tests: concrete examples and edge cases ----------------------------

describe('lockoutService — examples and edges (R1.1, R1.2, R1.3, R1.5)', () => {
  const KEY: LockoutKey = { clientIp: '203.0.113.7', email: 'driver@example.com' };
  const fail = (t: number) => lockoutService.recordFailure(KEY, new Date(t));
  const locked = (t: number) => lockoutService.isLocked(KEY, new Date(t));

  it('locks exactly on the 5th failure within the window, not the 4th', async () => {
    h.store.reset();
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) {
      await fail(T0 + i);
    }
    expect(await locked(T0 + 10)).toBe(false);

    await fail(T0 + 5);
    expect(await locked(T0 + 10)).toBe(true);
  });

  it('recordSuccess resets the counter so the key is no longer locked', async () => {
    h.store.reset();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await fail(T0 + i);
    }
    expect(await locked(T0 + 10)).toBe(true);

    await lockoutService.recordSuccess(KEY);
    expect(await locked(T0 + 10)).toBe(false);
  });

  it('does not count failures that fall outside the sliding window', async () => {
    h.store.reset();
    // Four failures far in the past (older than the window from `recent`).
    for (let i = 0; i < 4; i++) {
      await fail(T0 + i);
    }
    // One recent failure: only 1 within the window => not locked.
    const recent = T0 + LOCKOUT_WINDOW_MS + 60_000;
    await fail(recent);
    expect(await locked(recent)).toBe(false);
  });

  it('re-locks after the window elapses', async () => {
    h.store.reset();
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await fail(T0 + i);
    }
    expect(await locked(T0 + 10)).toBe(true);

    // After the window passes, old failures no longer count; five fresh ones
    // trip the gate again for the same key.
    const base = T0 + LOCKOUT_WINDOW_MS + 1;
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await fail(base + i);
    }
    expect(await locked(base + LOCKOUT_THRESHOLD)).toBe(true);
  });
});
