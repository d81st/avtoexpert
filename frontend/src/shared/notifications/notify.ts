import { toast, type ExternalToast } from "sonner";

/**
 * Публичный API уведомлений (`Notification_System` из спека).
 *
 * Обёртка над `sonner` toast: предоставляет четыре severity (`success`, `error`,
 * `info`, `warning`), валидирует длины полей и задаёт auto-dismiss длительности
 * согласно требованию 5.
 *
 * Контракты (см. `requirements.md` Requirement 5):
 * - AC 5.1, 5.13 — длина `message ∈ [1, 200]`, `title ∈ [1, 80]`,
 *   `description ∈ [1, 200]`; нарушение бросает `RangeError`.
 * - AC 5.3–5.6 — severities `success`/`error`/`info`/`warning` отображаются
 *   через соответствующие методы `toast.*`.
 * - AC 5.7 — `success` и `info` авто-закрываются через 5000 мс.
 * - AC 5.8 — `error` и `warning` авто-закрываются через 8000 мс.
 */

/** Максимальная длина основного сообщения и описания (AC 5.1, 5.13). */
const MAX_MESSAGE_LEN = 200;
/** Максимальная длина заголовка (AC 5.13). */
const MAX_TITLE_LEN = 80;

/** Auto-dismiss для success / info (AC 5.7). */
const SUCCESS_INFO_DURATION_MS = 5_000;
/** Auto-dismiss для error / warning (AC 5.8). */
const ERROR_WARNING_DURATION_MS = 8_000;

export interface NotifyOptions {
  /** Опциональный заголовок, длина 1..80 символов (AC 5.13). */
  title?: string;
  /** Опциональное описание, длина 1..200 символов (AC 5.13). */
  description?: string;
}

function assertLength(
  field: "message" | "title" | "description",
  value: string,
  min: number,
  max: number,
): void {
  if (value.length < min || value.length > max) {
    throw new RangeError(
      `notify: ${field} length must be in [${min}, ${max}], got ${value.length}`,
    );
  }
}

function buildToastOptions(
  options: NotifyOptions | undefined,
  durationMs: number,
): ExternalToast {
  const opts: ExternalToast = { duration: durationMs };

  if (options?.title !== undefined) {
    assertLength("title", options.title, 1, MAX_TITLE_LEN);
    // Sonner отображает первый аргумент `toast.*` как заголовок карточки;
    // здесь мы валидируем длину `title` для соблюдения контракта AC 5.13.
  }

  if (options?.description !== undefined) {
    assertLength("description", options.description, 1, MAX_MESSAGE_LEN);
    opts.description = options.description;
  }

  return opts;
}

/**
 * Публичный API уведомлений. Каждый метод принимает обязательное `message`
 * (1..200 символов) и опциональный объект `NotifyOptions`.
 */
export const notify = {
  /** Toast-уведомление об успехе. Auto-dismiss 5000 мс (AC 5.3, 5.7). */
  success(message: string, options?: NotifyOptions): void {
    assertLength("message", message, 1, MAX_MESSAGE_LEN);
    toast.success(message, buildToastOptions(options, SUCCESS_INFO_DURATION_MS));
  },

  /** Toast-уведомление об ошибке. Auto-dismiss 8000 мс (AC 5.4, 5.8). */
  error(message: string, options?: NotifyOptions): void {
    assertLength("message", message, 1, MAX_MESSAGE_LEN);
    toast.error(message, buildToastOptions(options, ERROR_WARNING_DURATION_MS));
  },

  /** Информационный toast. Auto-dismiss 5000 мс (AC 5.5, 5.7). */
  info(message: string, options?: NotifyOptions): void {
    assertLength("message", message, 1, MAX_MESSAGE_LEN);
    toast.info(message, buildToastOptions(options, SUCCESS_INFO_DURATION_MS));
  },

  /** Предупреждающий toast. Auto-dismiss 8000 мс (AC 5.6, 5.8). */
  warning(message: string, options?: NotifyOptions): void {
    assertLength("message", message, 1, MAX_MESSAGE_LEN);
    toast.warning(message, buildToastOptions(options, ERROR_WARNING_DURATION_MS));
  },
};
