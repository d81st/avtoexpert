interface AlertProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose?: () => void;
}

function Alert({ type, message, onClose }: AlertProps) {
  const colors = {
    success: "bg-green-50/90 border-green-200 text-green-800 shadow-sm",
    error: "bg-red-50/90 border-red-200 text-red-800 shadow-sm",
    warning: "bg-yellow-50/90 border-yellow-200 text-yellow-800 shadow-sm",
    info: "bg-blue-50/90 border-blue-200 text-blue-800 shadow-sm",
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <div
      className={`rounded-2xl border p-4 flex items-center justify-between backdrop-blur-sm ${colors[type]}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-base font-bold">
          {icons[type]}
        </span>
        <p className="text-sm font-medium leading-6">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-lg font-bold hover:opacity-70 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default Alert;
