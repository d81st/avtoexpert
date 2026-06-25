import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * shadcn/ui обёртка над `sonner` Toaster.
 *
 * Конфигурация по умолчанию:
 * - `position="bottom-right"` — десктоп (AC 5.14). На ширине <640px положение
 *   переопределяется глобальными CSS-правилами в `src/index.css` (см. задачу 3.2).
 * - `richColors` — цветовое кодирование severities (AC 5.3–5.6).
 * - `closeButton` — видимая кнопка закрытия с aria-label на каждом toast (AC 5.9).
 * - `visibleToasts={3}` — лимит одновременно видимых toast; более старые
 *   автоматически вытесняются в FIFO порядке (AC 5.10, 5.15).
 * - `expand={false}` — стак, а не вертикальное разворачивание (AC 5.10).
 *
 * Монтируется ровно один раз в корне приложения (AC 5.2) — см. задачу 3.1.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={3}
      expand={false}
      {...props}
    />
  );
}
