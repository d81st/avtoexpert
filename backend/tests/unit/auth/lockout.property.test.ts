import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Feature: remove-audit-subsystem.
 *
 * The auth lockout gate must enter the locked state for a given key at the
 * moment the 5th failure within a sliding 15-minute window is recorded; while
 * the count remains at or above the threshold the gate must keep returning
 * `isLocked === true` (the precondition for the route's HTTP 429); a
 * successful login must clear the counter; failures with stored timestamp
 * `t ≤ now − LOCKOUT_WINDOW_MS` must not contribute to the threshold at `now`.
 * Two failures share a key when either `client_ip` or `email` matches.
 *
 * Strategy: model-based testing (fast-check `fc.commands`) per the design's
 * Testing Strategy. The Drizzle data layer is stubbed with a deterministic
 * in-memory double so the sliding window is driven by an injectable `now`.
 * Three commands — recordFailure / recordSuccess / isLocked — advance a
 * virtual clock and are checked against an independent oracle that tracks
 * failure timestamps per key. The Lockout_Key generator emits at least one
 * pair of keys differing only by `client_ip` (same email) and at least one
 * pair differing only by `email` (same IP), exercising both legs of the
 * `(client_ip OR email)` predicate.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.1, 6.3
 */

const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 5;
const BASE = new Date('2026-06-26T12:00:00.000Z').getTime();

interface FailureRow {
  email: string | null;
  clientIp: string;
  createdAt: Date;
}

interface LockoutKey {
  clientIp: string;
  email?: string;
}

// Shared, hoisted harness referenced by the module mocks below. The store is
// an in-memory stand-in for the `auth_failures` table.
const h = vi.hoisted(() => {
  const store: { failures: FailureRow[] } = { failures: [] };

  // Schema column markers: each carries the JS row key the predicate reads.
  const authFailures = {
    __t: 'failures' as const,
    email: { key: 'email' },
    clientIp: { key: 'clientIp' },
    createdAt: { key: 'createdAt' },
  };

  type Row = Record<string, unknown>;
  const rowsFor = (_table: { __t: string }): Row[] =>
    store.failures as unknown as Row[];

  return { store, authFailures, rowsFor };
});

// Stub Drizzle's condition builders as plain row predicates so the in-memory
// `db` can evaluate the exact `(ip OR email) AND createdAt > cutoff` logic.
vi.mock('drizzle-orm', () => {
  type Col = { key: string };
  type Pred = (row: Record<string, unknown>) => boolean;
  return {
    count: () => ({ __agg: 'count' }),
    eq:
      (col: Col, val: unknown): Pred =>
      (row) =>
        row[col.key] === val,
    gt:
      (col: Col, val: unknown): Pred =>
      (row) =>
        (row[col.key] as { valueOf(): number }).valueOf() >
        (val as { valueOf(): number }).valueOf(),
    and:
      (...conds: Pred[]): Pred =>
      (row) =>
        conds.every((c) => c(row)),
    or:
      (...conds: Pred[]): Pred =>
      (row) =>
        conds.some((c) => c(row)),
  };
});

vi.mock('../../../src/db/schema.js', () => ({
  authFailures: h.authFailures,
}));

// In-memory `db` honouring the small query surface the service touches:
// select(count).from(table).where(pred), insert(table).values(row),
// delete(table).where(pred).
vi.mock('../../../src/db/index.js', () => {
  type Pred = (row: Record<string, unknown>) => boolean;
  const db = {
    select: () => ({
      from: (table: { __t: string }) => ({
        where: (pred: Pred) =>
          Promise.resolve([{ value: h.rowsFor(table).filter(pred).length }]),
      }),
    }),
    insert: (table: { __t: string }) => ({
      values: (row: Record<string, unknown>) => {
        h.rowsFor(table).push(row);
        return Promise.resolve();
      },
    }),
    delete: (table: { __t: string }) => ({
      where: (pred: Pred) => {
        const rows = h.rowsFor(table);
        const kept = rows.filter((r) => !pred(r));
        rows.length = 0;
        rows.push(...kept);
        return Promise.resolve();
      },
    }),
  };
  return { db };
});

const { lockoutService } = await import(
  '../../../src/modules/auth/lockout.service.js'
);

// Three keys cover both "differs only by email" and "differs only by ip"
// variations required by R6.3 (and the gate's (ip OR email) predicate):
// - KEY_A and KEY_SAME_IP   share `clientIp`, differ in `email`.
// - KEY_A and KEY_SAME_MAIL share `email`,    differ in `clientIp`.
const KEY_A: LockoutKey = {
  clientIp: '203.0.113.7',
  email: 'driver@example.com',
};
const KEY_SAME_IP: LockoutKey = {
  clientIp: '203.0.113.7',
  email: 'other@example.com',
};
const KEY_SAME_MAIL: LockoutKey = {
  clientIp: '203.0.113.8',
  email: 'driver@example.com',
};

const keyArb: fc.Arbitrary<LockoutKey> = fc.constantFrom(
  KEY_A,
  KEY_SAME_IP,
  KEY_SAME_MAIL,
);

/** Fresh system-under-test wrapper over a virtual clock; resets the store. */
function createSut() {
  h.store.failures = [];
  return {
    now: BASE,
    advance(dt: number) {
      this.now += dt;
    },
    async recordFailure(key: LockoutKey) {
      await lockoutService.recordFailure(key, new Date(this.now));
    },
    async recordSuccess(key: LockoutKey) {
      await lockoutService.recordSuccess(key);
    },
    isLocked(key: LockoutKey) {
      return lockoutService.isLocked(key, new Date(this.now));
    },
  };
}

type Sut = ReturnType<typeof createSut>;

/** Oracle row: mirrors the columns of a stored auth_failures entry. */
interface ModelRow {
  clientIp: string;
  email: string | null;
  t: number;
}

interface Model {
  now: number;
  rows: ModelRow[];
}

/** Predicate `(client_ip = key.clientIp OR email = key.email)` over a row. */
function matchesKey(row: ModelRow, key: LockoutKey): boolean {
  if (row.clientIp === key.clientIp) return true;
  if (key.email !== undefined && key.email !== '' && row.email === key.email) {
    return true;
  }
  return false;
}

/** Count of rows for `key` whose stored timestamp lies in `(now − WINDOW, now]`. */
function windowCount(m: Model, key: LockoutKey): number {
  const cutoff = m.now - WINDOW_MS;
  return m.rows.filter((r) => matchesKey(r, key) && r.t > cutoff).length;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('Auth lockout state machine — gate contract', () => {
  const dtArb = fc.integer({ min: 0, max: 20 * 60 * 1000 });

  class FailCommand implements fc.AsyncCommand<Model, Sut> {
    constructor(
      private readonly dt: number,
      private readonly key: LockoutKey,
    ) {}
    check() {
      return true;
    }
    async run(m: Model, r: Sut): Promise<void> {
      r.advance(this.dt);
      m.now += this.dt;

      // Oracle: append the failure first so the inserted row participates in
      // the threshold count, mirroring the service's insert-then-count order.
      m.rows.push({
        clientIp: this.key.clientIp,
        email: this.key.email ?? null,
        t: m.now,
      });
      const count = windowCount(m, this.key);

      await r.recordFailure(this.key);

      // Gate state matches the model immediately after the failure is recorded:
      // locked iff the windowed count for the key reaches the threshold.
      expect(await r.isLocked(this.key)).toBe(count >= THRESHOLD);
    }
    toString() {
      return `recordFailure(${JSON.stringify(this.key)}, +${this.dt}ms)`;
    }
  }

  class SuccessCommand implements fc.AsyncCommand<Model, Sut> {
    constructor(
      private readonly dt: number,
      private readonly key: LockoutKey,
    ) {}
    check() {
      return true;
    }
    async run(m: Model, r: Sut): Promise<void> {
      r.advance(this.dt);
      m.now += this.dt;

      // Success clears every row matching the same (ip OR email) predicate
      // the gate uses, so the next isLocked for that key is necessarily false.
      m.rows = m.rows.filter((row) => !matchesKey(row, this.key));
      await r.recordSuccess(this.key);

      expect(await r.isLocked(this.key)).toBe(false);
    }
    toString() {
      return `recordSuccess(${JSON.stringify(this.key)}, +${this.dt}ms)`;
    }
  }

  class CheckCommand implements fc.AsyncCommand<Model, Sut> {
    constructor(
      private readonly dt: number,
      private readonly key: LockoutKey,
    ) {}
    check() {
      return true;
    }
    async run(m: Model, r: Sut): Promise<void> {
      r.advance(this.dt);
      m.now += this.dt;

      expect(await r.isLocked(this.key)).toBe(
        windowCount(m, this.key) >= THRESHOLD,
      );
    }
    toString() {
      return `isLocked(${JSON.stringify(this.key)}, +${this.dt}ms)`;
    }
  }

  it('matches the gate oracle across arbitrary attempt sequences', async () => {
    const commands = [
      fc.tuple(dtArb, keyArb).map(([dt, k]) => new FailCommand(dt, k)),
      fc.tuple(dtArb, keyArb).map(([dt, k]) => new SuccessCommand(dt, k)),
      fc.tuple(dtArb, keyArb).map(([dt, k]) => new CheckCommand(dt, k)),
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.commands(commands, { maxCommands: 40 }),
        async (cmds) => {
          const setup = () => ({
            model: { now: BASE, rows: [] } as Model,
            real: createSut(),
          });
          await fc.asyncModelRun(setup, cmds);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('lockout service — unit examples', () => {
  const KEY = KEY_A;

  it('is not locked below the threshold', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD - 1; i++) {
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(false);
  });

  it('locks on the THRESHOLD-th failure within the window', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD; i++) {
      sut.advance(60 * 1000); // one minute apart, all inside 15 min
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(true);
  });

  it('does not lock when failures fall outside the sliding window', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD - 1; i++) {
      sut.advance(60 * 1000);
      await sut.recordFailure(KEY);
    }
    // Jump beyond the window so the earlier failures age out, then add one
    // more: only that single fresh failure should count.
    sut.advance(WINDOW_MS + 1);
    await sut.recordFailure(KEY);
    expect(await sut.isLocked(KEY)).toBe(false);
  });

  it('resets the counter on a successful login', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD; i++) {
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(true);

    await sut.recordSuccess(KEY);
    expect(await sut.isLocked(KEY)).toBe(false);

    // Need a fresh streak of THRESHOLD failures to lock again.
    for (let i = 0; i < THRESHOLD - 1; i++) {
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(false);
  });

  it('re-locks in a later window after the prior failures age out', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD; i++) {
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(true);

    sut.advance(WINDOW_MS + 1);
    for (let i = 0; i < THRESHOLD; i++) {
      await sut.recordFailure(KEY);
    }
    expect(await sut.isLocked(KEY)).toBe(true);
  });

  it('counts failures across keys that share client_ip (email-only variation)', async () => {
    const sut = createSut();
    // THRESHOLD-1 failures recorded against KEY_SAME_IP (same IP, other email).
    for (let i = 0; i < THRESHOLD - 1; i++) {
      await sut.recordFailure(KEY_SAME_IP);
    }
    // One more from KEY_A trips the gate via the shared client_ip leg.
    await sut.recordFailure(KEY_A);
    expect(await sut.isLocked(KEY_A)).toBe(true);
    expect(await sut.isLocked(KEY_SAME_IP)).toBe(true);
  });

  it('counts failures across keys that share email (client_ip-only variation)', async () => {
    const sut = createSut();
    for (let i = 0; i < THRESHOLD - 1; i++) {
      await sut.recordFailure(KEY_SAME_MAIL);
    }
    await sut.recordFailure(KEY_A);
    expect(await sut.isLocked(KEY_A)).toBe(true);
    expect(await sut.isLocked(KEY_SAME_MAIL)).toBe(true);
  });
});
