import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounces a side-effect function by the given delay (Requirement 1.4, 1.5).
 *
 * Returns a stable callback that, on each invocation, restarts a single timer and
 * runs `fn` only after `delayMs` of silence has elapsed since the last call. This
 * keeps any network request, IndexedDB access or otherwise heavy work OFF the
 * `input`/`change` keystroke path: the DOM `value` update is never blocked waiting
 * for the side effect (R1.5), and the effect fires at most once per quiet window
 * sized between 300–500 ms (R1.4).
 *
 * The latest `fn` is always invoked via a ref, so callers may pass an inline
 * closure without changing the returned callback's identity or resetting the
 * pending timer. The pending timer is cleared on unmount.
 *
 * @param fn - The side effect to run after the debounce window.
 * @param delayMs - Quiet-window length in milliseconds before `fn` runs.
 * @returns A stable debounced callback forwarding its arguments to `fn`.
 */
export function useDebouncedSideEffect<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delayMs: number,
): (...args: TArgs) => void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [],
  );

  return useCallback(
    (...args: TArgs) => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fnRef.current(...args);
      }, delayMs);
    },
    [delayMs],
  );
}
