import { selectIsActive, useGlobalLoadingStore } from './useGlobalLoadingStore';

/**
 * Diagnostic watchdog for the Global Loading Manager.
 *
 * Listens to `useGlobalLoadingStore` and emits a single `console.warn` when
 * the manager has been continuously active for longer than {@link WARN_AFTER_MS}.
 * Once a warning is emitted for a given active period, no further warnings
 * are produced until the manager returns to the idle state.
 *
 * The module subscribes on import (side-effect import from the app root) so
 * the watchdog is wired up exactly once for the lifetime of the app.
 *
 * AC references (Requirement 4):
 * - 4.12 — single diagnostic warning after >30s active, suppressed until reset
 */

/** Threshold for emitting a long-running incident warning, milliseconds. */
const WARN_AFTER_MS = 30_000;

/**
 * Generate an incident identifier for correlating logs.
 *
 * Prefers `crypto.randomUUID` (available in modern browsers and Node 19+).
 * Falls back to a timestamp + random suffix if the API is unavailable so the
 * watchdog never throws on exotic environments (tests, polyfilled SSR, etc.).
 */
function generateIncidentId(): string {
  const c: Crypto | undefined = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `incident-${Date.now().toString(36)}-${rand}`;
}

/**
 * Cross-environment timer handle type. Browsers return `number`; Node's
 * `setTimeout` returns a `Timeout` object. `ReturnType<typeof setTimeout>`
 * covers both.
 */
type TimerHandle = ReturnType<typeof setTimeout>;

let timerId: TimerHandle | null = null;
let unsubscribe: (() => void) | null = null;

function clearTimer(): void {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

function onStoreChange(
  state: ReturnType<typeof useGlobalLoadingStore.getState>,
  prev: ReturnType<typeof useGlobalLoadingStore.getState>,
): void {
  const wasActive = selectIsActive(prev);
  const isActive = selectIsActive(state);

  // inactive → active: arm the 30s watchdog timer.
  if (!wasActive && isActive) {
    clearTimer();
    timerId = setTimeout(() => {
      timerId = null;
      const current = useGlobalLoadingStore.getState();
      // Guard re-check: only warn if still active AND no warning has been
      // recorded for the current active period (AC 4.12).
      if (!selectIsActive(current)) return;
      if (current.lastWarnedIncidentId !== null) return;

      const incidentId = generateIncidentId();
      console.warn(
        `[GlobalLoading] Active for >${WARN_AFTER_MS}ms. pendingRequests=${current.pendingRequests}, incidentId=${incidentId}`,
      );
      // Record the incident id so subsequent listener invocations within
      // the same active period do not re-warn (AC 4.12).
      useGlobalLoadingStore.setState({ lastWarnedIncidentId: incidentId });
    }, WARN_AFTER_MS);
    return;
  }

  // active → inactive: cancel any pending warning and clear the suppression
  // marker. The store already nulls `lastWarnedIncidentId` on this transition;
  // the explicit reset here is defensive in case the store contract changes.
  if (wasActive && !isActive) {
    clearTimer();
    if (state.lastWarnedIncidentId !== null) {
      useGlobalLoadingStore.setState({ lastWarnedIncidentId: null });
    }
  }
}

/**
 * Activate the watchdog by subscribing to store state transitions.
 *
 * Idempotent — repeated calls are a no-op while an active subscription
 * exists. Primarily intended to be called once via the side-effect import
 * from the app root; exported so tests can re-arm the watchdog after
 * {@link stopDiagnosticWatchdog}.
 */
export function startDiagnosticWatchdog(): void {
  if (unsubscribe !== null) return;
  unsubscribe = useGlobalLoadingStore.subscribe(onStoreChange);
}

/**
 * Tear down the active subscription and any pending timer. Intended for
 * tests; production code leaves the watchdog running for the lifetime of the
 * document.
 */
export function stopDiagnosticWatchdog(): void {
  clearTimer();
  if (unsubscribe !== null) {
    unsubscribe();
    unsubscribe = null;
  }
}

// Side-effect activation: the module is imported from the app root specifically
// for this subscription.
startDiagnosticWatchdog();
