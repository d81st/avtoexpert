import { CircleCheck, CircleX, TriangleAlert, Info } from "lucide-react";

export const ALERT_ICON_MAP = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
} as const;

export type AlertType = keyof typeof ALERT_ICON_MAP;
