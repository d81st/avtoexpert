export type StatusVariant = "default" | "secondary" | "outline" | "draft" | "completed" | "unknown";

export interface StatusConfig {
  variant: StatusVariant;
  label: string;
}

export const STATUS_VARIANT_MAP: Record<string, StatusConfig> = {
  draft: { variant: "draft", label: "Черновик" },
  completed: { variant: "completed", label: "Завершено" },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_VARIANT_MAP[status] ?? { variant: "unknown", label: status };
}
