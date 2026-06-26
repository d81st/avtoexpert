import { memo, type ReactNode } from 'react';
import type { Control, FieldValues, Path, RegisterOptions } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDebouncedStoreSync } from '../../hooks/useDebouncedStoreSync';
import { FieldError, useIsolatedField } from '../../hooks/useIsolatedField';

/**
 * Shared per-field building blocks for the Wizard steps (Requirement 1).
 *
 * Every editable native input is registered through {@link useIsolatedField},
 * i.e. react-hook-form's uncontrolled `register`. Typing therefore never triggers
 * a parent `setState`: React batches the native DOM update in the same microtask,
 * the caret position is preserved (R1.1, R1.2) and sibling fields are not
 * re-rendered (R1.3). Validation output is confined to the sibling
 * {@link FieldError} selector, so an async validator resolving never overwrites the
 * user's current input. Each field component is memoized so a parent re-render does
 * not cascade into untouched fields.
 *
 * Radix `Select`, radio groups and other non-native controls keep using
 * `<Controller>` in the step files — `Controller` is itself a single-field selector
 * subscription and does not read the root form state.
 */

interface FieldShellProps {
  name: string;
  label: ReactNode;
  required?: boolean;
  description?: ReactNode;
  className?: string;
}

function RequiredMark() {
  return <span className="text-red-500"> *</span>;
}

export interface IsolatedTextFieldProps extends FieldShellProps {
  type?: 'text' | 'date' | 'email' | 'tel' | 'url' | 'search' | 'password';
  placeholder?: string;
  maxLength?: number;
  list?: string;
  readOnly?: boolean;
  inputClassName?: string;
  registerOptions?: RegisterOptions;
  /**
   * Live display transform applied on every input event (e.g. upper-casing a VIN).
   * Mutates the uncontrolled input value in place before react-hook-form reads it,
   * so the stored value and the visible value stay in sync without a controlled
   * `value` prop (which would otherwise reset the caret).
   */
  transformValue?: (raw: string) => string;
  /** Optional node rendered immediately after the input (e.g. a `<datalist>`). */
  afterInput?: ReactNode;
}

/**
 * Isolated text-like field backed by an uncontrolled `register` (R1.1–R1.3).
 */
export const IsolatedTextField = memo(function IsolatedTextField({
  name,
  label,
  required,
  description,
  className,
  type = 'text',
  placeholder,
  maxLength,
  list,
  readOnly,
  inputClassName,
  registerOptions,
  transformValue,
  afterInput,
}: IsolatedTextFieldProps) {
  const field = useIsolatedField(name as Path<FieldValues>, registerOptions);
  const id = `field-${name}`;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        list={list}
        readOnly={readOnly}
        className={inputClassName}
        {...field}
        onChange={
          transformValue
            ? (e) => {
                e.target.value = transformValue(e.target.value);
                void field.onChange(e);
              }
            : field.onChange
        }
      />
      {afterInput}
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <FieldError name={name} />
    </div>
  );
});

export interface IsolatedNumberFieldProps extends FieldShellProps {
  placeholder?: string;
  min?: number;
  parse?: 'int' | 'float';
  /** When true, an empty input resolves to `undefined`; otherwise to `0`. */
  optional?: boolean;
  /** Value an empty input resolves to. Overrides the `optional`/`0` defaults. */
  emptyValue?: number;
  readOnly?: boolean;
  inputClassName?: string;
  /** Side effect invoked with the parsed value after react-hook-form updates. */
  onValueChange?: (value: number | undefined) => void;
}

/**
 * Isolated numeric field backed by an uncontrolled `register` with `setValueAs`
 * so react-hook-form stores a `number` (R1.1–R1.3).
 */
export const IsolatedNumberField = memo(function IsolatedNumberField({
  name,
  label,
  required,
  description,
  className,
  placeholder,
  min,
  parse = 'int',
  optional,
  emptyValue,
  readOnly,
  inputClassName,
  onValueChange,
}: IsolatedNumberFieldProps) {
  const setValueAs = (raw: string): number | undefined => {
    const parsed = parse === 'float' ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      if (emptyValue !== undefined) {
        return emptyValue;
      }
      return optional ? undefined : 0;
    }
    return parsed;
  };

  const field = useIsolatedField(name as Path<FieldValues>, { setValueAs });
  const id = `field-${name}`;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </Label>
      <Input
        id={id}
        type="number"
        placeholder={placeholder}
        min={min}
        readOnly={readOnly}
        className={inputClassName}
        {...field}
        onChange={
          onValueChange
            ? (e) => {
                void field.onChange(e);
                onValueChange(setValueAs(e.target.value));
              }
            : field.onChange
        }
      />
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <FieldError name={name} />
    </div>
  );
});

interface FormStoreSyncProps<T extends FieldValues> {
  control: Control<T>;
  setter: (data: T) => void;
  delay?: number;
}

/**
 * Renders nothing — it only drives the debounced Zustand store sync.
 *
 * The store sync reads every field through `useWatch`, which would re-render its
 * host on every keystroke. Mounting it in this dedicated leaf keeps that
 * whole-form subscription out of the Step component's render path, so editing a
 * field never re-renders sibling fields (R1.3).
 */
function FormStoreSyncInner<T extends FieldValues>({
  control,
  setter,
  delay = 300,
}: FormStoreSyncProps<T>) {
  useDebouncedStoreSync(control, setter, delay);
  return null;
}

export const FormStoreSync = memo(FormStoreSyncInner) as typeof FormStoreSyncInner;
