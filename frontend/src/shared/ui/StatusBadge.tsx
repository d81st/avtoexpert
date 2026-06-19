interface StatusBadgeProps {
  status: "draft" | "completed" | string;
}

const STATUS_MAP = {
  completed: {
    label: "Завершено",
    className: "bg-green-100 text-green-800",
  },
  draft: {
    label: "Черновик",
    className: "bg-yellow-100 text-yellow-800",
  },
} as const;

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status as keyof typeof STATUS_MAP] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
