import { create } from "zustand";

/**
 * Global Loading Manager state.
 *
 * Centralised, single source of truth for active network activity and
 * navigation transitions. Drives `GlobalLoadingOverlay` visibility and the
 * diagnostic >30s watchdog.
 *
 * AC references (Requirement 4):
 * - 4.1 — observable fields: counter + navigation flag
 * - 4.2 — atomic increment on outgoing request
 * - 4.3 — atomic decrement on completion, clamped at 0
 * - 4.6 — `isActive := pendingRequests > 0 || isNavigationPending`
 */
interface GlobalLoadingState {
  /**
   * Number of initiated but not-yet-completed non-background HTTP requests.
   * Range: 0..2147483647 (AC 4.1, 4.3).
   */
  pendingRequests: number;
  /** Whether a programmatic navigation transition is in progress (AC 4.1, 4.5). */
  isNavigationPending: boolean;
  /**
   * Timestamp (ms since epoch) marking the start of the current uninterrupted
   * active period. `null` when the manager is idle. Used by the diagnostic
   * watchdog (AC 4.12).
   */
  activeSince: number | null;
  /**
   * Identifier of the last >30s warning emitted for the current active period.
   * Used to suppress repeats until the counter returns to zero (AC 4.12).
   */
  lastWarnedIncidentId: string | null;
}

interface GlobalLoadingActions {
  /** AC 4.2 — atomic increment on request initiation. */
  incrementRequests: () => void;
  /** AC 4.3 — atomic decrement on request completion; clamped at 0. */
  decrementRequests: () => void;
  /** AC 4.5 — mark navigation transition active. */
  startNavigation: () => void;
  /** AC 4.5 — mark navigation transition complete. */
  endNavigation: () => void;
}

export type GlobalLoadingStore = GlobalLoadingState & GlobalLoadingActions;

export const useGlobalLoadingStore = create<GlobalLoadingStore>((set) => ({
  pendingRequests: 0,
  isNavigationPending: false,
  activeSince: null,
  lastWarnedIncidentId: null,

  incrementRequests: () =>
    set((s) => {
      const next = s.pendingRequests + 1;
      const wasActive = s.pendingRequests > 0 || s.isNavigationPending;
      return {
        pendingRequests: next,
        // Preserve activeSince across continuous active periods; start a new
        // period only on the idle→active transition.
        activeSince: wasActive ? s.activeSince : Date.now(),
      };
    }),

  decrementRequests: () =>
    set((s) => {
      // AC 4.3 — clamp at 0 so the counter cannot go negative under any
      // sequencing of interceptor calls (duplicate completions, races, etc.).
      const next = Math.max(0, s.pendingRequests - 1);
      const stillActive = next > 0 || s.isNavigationPending;
      return {
        pendingRequests: next,
        activeSince: stillActive ? s.activeSince : null,
        // Reset the warning suppression when the active period ends, so the
        // next long-running incident can be reported (AC 4.12).
        lastWarnedIncidentId: stillActive ? s.lastWarnedIncidentId : null,
      };
    }),

  startNavigation: () =>
    set((s) => {
      const wasActive = s.pendingRequests > 0 || s.isNavigationPending;
      return {
        isNavigationPending: true,
        activeSince: wasActive ? s.activeSince : Date.now(),
      };
    }),

  endNavigation: () =>
    set((s) => {
      const stillActive = s.pendingRequests > 0;
      return {
        isNavigationPending: false,
        activeSince: stillActive ? s.activeSince : null,
        lastWarnedIncidentId: stillActive ? s.lastWarnedIncidentId : null,
      };
    }),
}));

/**
 * Derived selector — true when the manager has any pending non-background
 * request OR an in-flight navigation transition (AC 4.6).
 *
 * Defined as a stable module-level reference so consumers can pass it directly
 * to `useGlobalLoadingStore(selectIsActive)` without retriggering subscriptions.
 */
export const selectIsActive = (s: GlobalLoadingState): boolean =>
  s.pendingRequests > 0 || s.isNavigationPending;
