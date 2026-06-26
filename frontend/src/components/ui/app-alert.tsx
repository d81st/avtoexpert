import { X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ALERT_ICON_MAP, type AlertType } from '@/lib/alert-variants';

interface AppAlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

function AppAlert({ type, message, onClose }: AppAlertProps) {
  const Icon = ALERT_ICON_MAP[type];
  const variant = type === 'error' ? 'destructive' : 'default';

  return (
    <Alert variant={variant} className="relative">
      <Icon className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </Alert>
  );
}

export type { AppAlertProps };
export { AppAlert };
