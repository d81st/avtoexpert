import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  fullWidth?: boolean;
}

function Input({
  label,
  error,
  helper,
  fullWidth = true,
  className = "",
  ...props
}: InputProps) {
  const baseStyles =
    "form-control px-4 py-3 text-slate-900 placeholder:text-slate-400";
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
      <input
        className={`${baseStyles} ${errorStyles} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
      {helper && !error && (
        <p className="mt-1.5 text-xs text-slate-500">{helper}</p>
      )}
    </div>
  );
}

export default Input;
