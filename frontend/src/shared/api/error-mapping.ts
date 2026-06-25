import type { AxiosError } from "axios";

/**
 * Максимальная длина пользовательского сообщения об ошибке (AC 5.12).
 */
const MAX_LEN = 200;

/**
 * Fallback-сообщение, возвращаемое при пустом или полностью очищенном
 * исходном тексте ошибки (AC 5.12).
 */
const FALLBACK_MESSAGE = "Произошла ошибка. Попробуйте ещё раз.";

/**
 * Паттерн фреймов стек-трейса вида "at fnName (file:line:col)".
 * Используется для удаления внутренних деталей реализации, которые
 * не должны попадать в пользовательский toast (AC 5.12).
 */
const STACK_FRAME_PATTERN = /\bat\s+\S+\s+\([^)]+\)/g;

/**
 * Паттерн UUID v4 (а также любой канонический UUID 8-4-4-4-12 hex).
 * Используется для удаления внутренних идентификаторов из сообщения (AC 5.12).
 */
const UUID_PATTERN =
  /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi;

/**
 * Превращает {@link AxiosError} в человекочитаемое сообщение для показа
 * пользователю через Notification_System.
 *
 * Алгоритм:
 * 1. Извлекается кандидат из `response.data.message`, `response.data.error`
 *    или `error.message` (в указанном порядке предпочтения).
 * 2. Из кандидата удаляются стек-трейсы и UUID, лишние пробелы нормализуются.
 * 3. Результат обрезается до 200 символов (с многоточием при усечении).
 * 4. При пустом или полностью очищенном результате возвращается fallback.
 *
 * @see Requirement 5.12
 */
export function sanitizeErrorMessage(error: AxiosError): string {
  const data = error.response?.data as
    | { message?: unknown; error?: unknown }
    | undefined;

  const candidate =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    error.message;

  if (!candidate) return FALLBACK_MESSAGE;

  const cleaned = candidate
    .replace(STACK_FRAME_PATTERN, "")
    .replace(UUID_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return FALLBACK_MESSAGE;

  return cleaned.length > MAX_LEN
    ? `${cleaned.slice(0, MAX_LEN - 1)}…`
    : cleaned;
}
