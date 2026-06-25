import { useCallback, useEffect, useRef } from "react";
import {
  useLocation,
  useNavigate,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { useGlobalLoadingStore } from "./useGlobalLoadingStore";

/**
 * Hard timeout for programmatic navigation transitions.
 *
 * Safety net for the case when the destination route never mounts (router
 * error, redirect chain, etc.). Once this fires we forcibly clear the
 * navigation flag so `Global_Loading_Overlay` cannot get stuck on screen.
 *
 * AC reference (Requirement 4):
 * - 4.5 — navigation flag resets at the first of: target route mount OR 5000 ms
 *   elapsed since activation.
 */
const NAVIGATION_HARD_TIMEOUT_MS = 5_000;

/**
 * `useGlobalNavigate` — drop-in replacement for `useNavigate` from
 * `react-router-dom` that integrates with the Global Loading Manager.
 *
 * Behaviour on each call:
 * 1. Atomically flips `isNavigationPending` to `true` via `startNavigation()`.
 * 2. Schedules a hard timeout that calls `endNavigation()` after 5000 ms as a
 *    safety net (AC 4.5). The previous pending timeout is cleared first so
 *    that an in-flight safety timer for an earlier navigation can never reset
 *    the flag for a freshly started one.
 * 3. Delegates to the underlying `navigate(...)` so callers see the same
 *    semantics as `useNavigate` (including the `navigate(delta)` overload).
 *
 * The companion `<NavigationWatcher />` component is responsible for the
 * happy-path reset — it fires `endNavigation()` as soon as the new route
 * mounts (pathname change), which in practice will resolve well before the
 * 5000 ms hard timeout.
 *
 * Intended only for **programmatic** navigations after save/generate/etc.
 * Direct `<Link>` clicks and user-initiated transitions remain untracked
 * by the Global Loading Manager (AC 4.5 — "программно инициирует переход").
 *
 * Validates: Requirement 4.5.
 */
export function useGlobalNavigate(): NavigateFunction {
  const navigate = useNavigate();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup any pending safety timer on unmount so we never leak a timer that
  // would flip the navigation flag after the calling component is gone.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Inline arrow on purpose — the `react-hooks/use-memo` rule requires the
  // first argument of `useCallback` to be an inline function expression
  // (not a parenthesised cast). We annotate the parameters locally to cover
  // both react-router `NavigateFunction` overloads — `(to: To, options?)` and
  // `(delta: number)` — and cast the *returned* callback to `NavigateFunction`
  // so callers see the same overloaded signature as `useNavigate`.
  const navigateWithLoading = useCallback(
    (to: To | number, options?: NavigateOptions) => {
      const { startNavigation, endNavigation } =
        useGlobalLoadingStore.getState();

      // AC 4.5 — mark navigation active before delegating to react-router.
      startNavigation();

      // Clear any prior safety timer so it cannot prematurely terminate the
      // newly-started navigation tracking when it fires later.
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        endNavigation();
      }, NAVIGATION_HARD_TIMEOUT_MS);

      // `NavigateFunction` is overloaded: `(to: To, options?)` and `(delta: number)`.
      // Dispatch to the matching overload so both call shapes type-check.
      if (typeof to === "number") {
        return navigate(to);
      }
      return navigate(to, options);
    },
    [navigate],
  );

  return navigateWithLoading as NavigateFunction;
}

/**
 * `<NavigationWatcher />` — invisible component that resets the global
 * navigation flag whenever react-router mounts a new pathname.
 *
 * Mount it exactly once inside `<BrowserRouter>` (typically in
 * `AppProviders`/`App`) so it observes every route change in the app.
 *
 * On every change of `location.pathname` (including the initial mount where
 * `isNavigationPending` is already `false` and the call is a harmless no-op),
 * it calls `endNavigation()`. Combined with `useGlobalNavigate`, this gives
 * the AC 4.5 contract: the navigation flag is cleared at the first of
 * `target route mount` OR `5000 ms hard timeout`.
 *
 * The store's `endNavigation` is idempotent, so duplicate calls are safe.
 *
 * Validates: Requirement 4.5.
 */
export function NavigationWatcher(): null {
  const { pathname } = useLocation();

  useEffect(() => {
    useGlobalLoadingStore.getState().endNavigation();
  }, [pathname]);

  return null;
}
