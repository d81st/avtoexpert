import { act, renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedSideEffect } from '@/features/reports/hooks/useDebouncedSideEffect';

/**
 * Property 3: Debounced side-effect timing.
 *
 * For any sequence of keystroke events with inter-event intervals drawn from
 * [0, 2000] ms and any `delayMs` chosen from the R1.4 range [300, 500] ms, the
 * debounced side-effect callback MUST be invoked exactly once for each quiet
 * period of length ≥ `delayMs` ending at the last keystroke before that quiet
 * period, with the actual invocation occurring `delayMs` ms after the last
 * keystroke and receiving the args from that final keystroke.
 *
 * Oracle (independent re-statement of the trailing-debounce contract):
 *   Given events e_0, e_1, …, e_{n-1} with absolute times t_i (t_0 = 0) and
 *   gaps g_i = t_i − t_{i-1} (with g_0 = 0), the side effect fires exactly for
 *   the set of indices `i` where either:
 *     • `i = n - 1` (last event, followed by ≥ delayMs of silence), or
 *     • `g_{i+1} ≥ delayMs` (next keystroke arrives no sooner than the timer).
 *   Each fire occurs at time `t_i + delayMs` with args `args_i`.
 *
 * The test drives the hook through this exact event schedule using Vitest fake
 * timers and verifies after each gap that the running invocation count and the
 * most-recent argument match the oracle.
 *
 * **Validates: Requirements 1.4**
 */

interface KeystrokeEvent {
  /** Milliseconds since the previous event; 0 for the first event. */
  gap: number;
  /** Distinct argument carried by this keystroke for latest-args verification. */
  arg: string;
}

const eventArb = fc.record({
  gap: fc.integer({ min: 0, max: 2000 }),
  arg: fc.string({ minLength: 1, maxLength: 8 }),
});

const eventsArb = fc.array(eventArb, { minLength: 1, maxLength: 20 });

// Sample delayMs from the R1.4 range. The trailing-debounce contract holds for
// any positive delay, but Requirement 1.4 fixes the design range to [300, 500].
const delayMsArb = fc.integer({ min: 300, max: 500 });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Property 3: Debounced side-effect timing', () => {
  it('cancels the pending side effect on unmount regardless of how much of the window has elapsed', () => {
    fc.assert(
      fc.property(eventsArb, delayMsArb, fc.integer({ min: 0, max: 600 }), (events, delayMs, unmountOffset) => {
        const normalized: KeystrokeEvent[] = events.map((event, index) => ({
          gap: index === 0 ? 0 : event.gap,
          arg: event.arg,
        }));

        const fn = vi.fn<(arg: string) => void>();
        const { result, unmount } = renderHook(() => useDebouncedSideEffect(fn, delayMs));

        let firesBeforeUnmount = 0;

        try {
          for (let i = 0; i < normalized.length; i++) {
            if (i > 0) {
              const gap = normalized[i].gap;
              act(() => {
                vi.advanceTimersByTime(gap);
              });
              if (gap >= delayMs) {
                firesBeforeUnmount += 1;
              }
            }
            const arg = normalized[i].arg;
            act(() => {
              result.current(arg);
            });
          }

          // Advance some sub-window amount (still strictly inside the trailing
          // window — `unmountOffset` is bounded below `delayMs`'s lower bound)
          // so that a pending timer is guaranteed to be armed at unmount time.
          const safeOffset = unmountOffset % delayMs;
          act(() => {
            vi.advanceTimersByTime(safeOffset);
          });

          // Snapshot fire count strictly before unmount; this is the oracle
          // upper bound for the post-unmount count.
          const firesAtUnmount = fn.mock.calls.length;
          expect(firesAtUnmount).toBe(firesBeforeUnmount);

          unmount();

          // After unmount, no matter how long we let virtual time progress, the
          // pending trailing-edge call MUST NOT fire.
          act(() => {
            vi.advanceTimersByTime(delayMs * 4);
          });
          expect(fn).toHaveBeenCalledTimes(firesAtUnmount);
        } finally {
          vi.clearAllTimers();
        }
      }),
      { numRuns: 100, verbose: true },
    );
  });

  it('fires exactly once per quiet window of `delayMs`, with the latest args', () => {
    fc.assert(
      fc.property(eventsArb, delayMsArb, (events, delayMs) => {
        // The first event's `gap` is meaningless (no previous keystroke); pin
        // it to 0 so test bookkeeping below matches the oracle.
        const normalized: KeystrokeEvent[] = events.map((event, index) => ({
          gap: index === 0 ? 0 : event.gap,
          arg: event.arg,
        }));

        const fn = vi.fn<(arg: string) => void>();
        const { result, unmount } = renderHook(() =>
          useDebouncedSideEffect(fn, delayMs),
        );

        try {
          let expectedFireCount = 0;
          let lastFiredArg: string | null = null;

          for (let i = 0; i < normalized.length; i++) {
            if (i > 0) {
              const gap = normalized[i].gap;
              act(() => {
                vi.advanceTimersByTime(gap);
              });

              if (gap >= delayMs) {
                // A trailing fire from event i-1 happens during this gap.
                expectedFireCount += 1;
                lastFiredArg = normalized[i - 1].arg;
              }

              expect(fn).toHaveBeenCalledTimes(expectedFireCount);
              if (lastFiredArg !== null) {
                expect(fn.mock.calls.at(-1)?.[0]).toBe(lastFiredArg);
              }
            }

            const arg = normalized[i].arg;
            act(() => {
              result.current(arg);
            });
            // Issuing a call inside the quiet window cancels any pending timer,
            // so the running fire count must not change at the call site.
            expect(fn).toHaveBeenCalledTimes(expectedFireCount);
          }

          // After the final keystroke, advancing by `delayMs - 1` MUST NOT fire
          // (timer not yet expired) and advancing by exactly 1 more MUST fire
          // once with the final keystroke's argument.
          act(() => {
            vi.advanceTimersByTime(delayMs - 1);
          });
          expect(fn).toHaveBeenCalledTimes(expectedFireCount);

          act(() => {
            vi.advanceTimersByTime(1);
          });
          expectedFireCount += 1;
          lastFiredArg = normalized[normalized.length - 1].arg;

          expect(fn).toHaveBeenCalledTimes(expectedFireCount);
          expect(fn.mock.calls.at(-1)?.[0]).toBe(lastFiredArg);

          // Cross-check the running total against the closed-form oracle.
          const oracleCount = countOracleFires(normalized, delayMs);
          expect(expectedFireCount).toBe(oracleCount);
        } finally {
          unmount();
          vi.clearAllTimers();
        }
      }),
      { numRuns: 100, verbose: true },
    );
  });
});

/**
 * Closed-form oracle: counts the number of quiet windows that terminate with
 * a fire under trailing-debounce semantics with delay `delayMs`.
 */
function countOracleFires(events: KeystrokeEvent[], delayMs: number): number {
  let count = 0;
  for (let i = 0; i < events.length; i++) {
    const nextGap = i + 1 < events.length ? events[i + 1].gap : Number.POSITIVE_INFINITY;
    if (nextGap >= delayMs) {
      count += 1;
    }
  }
  return count;
}
