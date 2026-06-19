import { type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  fullWidth?: boolean;
}

function Select({
  label,
  error,
  options,
  fullWidth = true,
  className = "",
  ...props
}: SelectProps) {
  const baseStyles = "form-control px-4 py-3 text-slate-900";
  const errorStyles = error
    ? "border-red-300 bg-red-50 focus:ring-red-200"
    : "";
  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <div className={widthStyle}>
      {label && (
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          {label}
          {props.required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        className={`${baseStyles} ${errorStyles} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {props.children}
      </select>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}

export default Select;
