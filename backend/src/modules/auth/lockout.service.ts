import { and, count, eq, gt, or, type SQL } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { authFailures } from '../../db/schema.js';
import { logger } from '../../shared/logger/logger.js';

/**
 * Number of `auth_failure` events within {@link LOCKOUT_WINDOW_MS} that trips
 * the lockout. The 5th failure crosses the threshold.
 */
export const LOCKOUT_THRESHOLD = 5;

/**
 * Sliding window length used for both the failure counter and the lockout
 * duration: 900 seconds / 15 minutes.
 */
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Identifies an authentication attempt for lockout purposes. A request is
 * locked when EITHER the originating `clientIp` OR the targeted `email`
 * accumulates {@link LOCKOUT_THRESHOLD} failures inside the window.
 */
export interface LockoutKey {
  clientIp: string;
  email?: string;
}

/**
 * Builds the `(client_ip = $ip OR email = $email)` predicate over
 * `auth_failures`. When no email is supplied the predicate degrades to the IP
 * match alone, matching the counter semantics.
 */
function failuresKeyCondition(key: LockoutKey): SQL {
  const ipClause = eq(authFailures.clientIp, key.clientIp);
  if (!key.email) {
    return ipClause;
  }
  // biome-ignore lint/style/noNonNullAssertion: email presence checked above
  return or(ipClause, eq(authFailures.email, key.email))!;
}

/** Resolves the lower bound of the sliding window relative to `now`. */
function windowStart(now: Date): Date {
  return new Date(now.getTime() - LOCKOUT_WINDOW_MS);
}

/**
 * Counts `auth_failure` rows for the key inside the window `(cutoff, now]`.
 * The lower bound is strict (`>`), matching the gate contract.
 */
async function countFailures(key: LockoutKey, now: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(authFailures)
    .where(
      and(
        failuresKeyCondition(key),
        gt(authFailures.createdAt, windowStart(now)),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Auth lockout state machine backed by the `auth_failures` table. The window
 * is sliding and keyed by `(client_ip, email)`.
 */
export const lockoutService = {
  /**
   * Returns true when the request must be denied with HTTP 429 because the
   * key has reached {@link LOCKOUT_THRESHOLD} failures inside the window.
   */
  async isLocked(key: LockoutKey, now: Date = new Date()): Promise<boolean> {
    const failures = await countFailures(key, now);
    return failures >= LOCKOUT_THRESHOLD;
  },

  /**
   * Records a failed authentication attempt. The failure row is inserted
   * before the threshold count is evaluated, so the inserted failure is
   * included in the decision (the 5th failure trips the gate on the same
   * request that recorded it).
   *
   * When the resulting count is at or above {@link LOCKOUT_THRESHOLD}, a
   * single structured `auth_lockout` log line is emitted via the shared
   * winston logger. No per-window dedup is performed: duplicate log lines for
   * the 6th, 7th, … failure inside the same sliding window are intentional.
   * The gate decision itself is taken at the route via `isLocked` and is
   * unaffected by log-line cardinality.
   */
  async recordFailure(key: LockoutKey, now: Date = new Date()): Promise<void> {
    await db.insert(authFailures).values({
      email: key.email ?? null,
      clientIp: key.clientIp,
      createdAt: now,
    });

    const failures = await countFailures(key, now);
    if (failures < LOCKOUT_THRESHOLD) {
      return;
    }

    logger.warn('auth_lockout', {
      category: 'security',
      eventType: 'auth_lockout',
      emailOrUserId: key.email ?? null,
      clientIp: key.clientIp,
      failures,
      windowMs: LOCKOUT_WINDOW_MS,
    });
  },

  /**
   * Clears recorded failures for the key on a successful login so the counter
   * resets and subsequent attempts start from zero. Deletes every row
   * matching the same predicate used by {@link isLocked}.
   */
  async recordSuccess(key: LockoutKey): Promise<void> {
    await db.delete(authFailures).where(failuresKeyCondition(key));
  },
};
