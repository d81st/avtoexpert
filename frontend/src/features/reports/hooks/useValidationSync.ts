import { useEffect } from 'react';

/**
 * Encapsulates useEffect for syncing react-hook-form's formState.isValid
 * with a parent callback. This is the idiomatic RHF pattern for notifying
 * a parent about form validity changes.
 *
 * Eliminates raw useEffect from Step components per requirement 5.6,
 * delegating validation sync logic into a reusable hook.
 */
export function useValidationSync(
  isValid: boolean,
  onValidationChange: (isValid: boolean) => void,
): void {
  useEffect(() => {
    onValidationChange(isValid);
  }, [isValid, onValidationChange]);
}
