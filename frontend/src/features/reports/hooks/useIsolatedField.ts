import { createElement, type ReactElement } from 'react';
import {
  type FieldErrors,
  type FieldValues,
  type Path,
  type RegisterOptions,
  type UseFormRegisterReturn,
  useFormContext,
  useFormState,
} from 'react-hook-form';

/**
 * Per-field registration hook that isolates input rendering from the rest of the
 * Managed_Form (Requirement 1).
 *
 * The hook returns react-hook-form's uncontrolled `register` props, so typing in a
 * field never triggers a parent `setState`: React batches the native DOM update in
 * the same microtask and the caret position is preserved (R1.1, R1.2). Because no
 * external `value` prop is attached and sibling fields are not read through a
 * root-level `watch()`, changing one field does not re-render unrelated siblings
 * (R1.3).
 *
 * Error display is intentionally delegated to the sibling {@link FieldError} helper,
 * which subscribes to `useFormState({ control, name })` scoped to a single field.
 * That keeps validation-result rendering (R1.6) confined to the error element and
 * out of the input's render path, so an async validator resolving never overwrites
 * the user's current input.
 *
 * Must be called inside a `<FormProvider>` (react-hook-form context).
 *
 * @param name - Field path, e.g. `"report_number"` or `"repair_works.2.price"`.
 * @param options - Standard react-hook-form `RegisterOptions`.
 * @returns The `register` props to spread onto a native input/select/textarea.
 */
export function useIsolatedField<TFieldValues extends FieldValues = FieldValues>(
  name: Path<TFieldValues>,
  options?: RegisterOptions<TFieldValues, Path<TFieldValues>>,
): UseFormRegisterReturn<Path<TFieldValues>> {
  const { register } = useFormContext<TFieldValues>();
  return register(name, options);
}

/**
 * Resolves the validation message for a (possibly nested) field path out of
 * react-hook-form's `errors` tree. Supports dotted paths and array indices, e.g.
 * `"repair_works.2.price"`.
 */
function getFieldErrorMessage(errors: FieldErrors, name: string): string | undefined {
  let current: unknown = errors;

  for (const segment of name.split('.')) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (
    current != null &&
    typeof current === 'object' &&
    'message' in current &&
    typeof (current as { message?: unknown }).message === 'string'
  ) {
    return (current as { message: string }).message;
  }

  return undefined;
}

export interface FieldErrorProps {
  /** Field path matching the one passed to {@link useIsolatedField}. */
  name: string;
  /** Optional class override for the rendered message element. */
  className?: string;
}

/**
 * Localized error display for a single field (Requirement 1.6).
 *
 * Subscribes to `useFormState({ control, name })`, so it re-renders only when the
 * referenced field's validation state changes — never on sibling field edits.
 * Renders nothing when the field has no error message.
 *
 * Must be rendered inside a `<FormProvider>` (react-hook-form context).
 */
export function FieldError({ name, className }: FieldErrorProps): ReactElement | null {
  const { control } = useFormContext();
  const { errors } = useFormState({ control, name });
  const message = getFieldErrorMessage(errors, name);

  if (!message) {
    return null;
  }

  return createElement(
    'p',
    {
      role: 'alert',
      className: className ?? 'text-sm font-medium text-destructive',
    },
    message,
  );
}
