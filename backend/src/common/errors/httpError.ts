export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details);

export const unauthorized = (message: string) => new HttpError(401, message);

export const forbidden = (message: string) => new HttpError(403, message);

export const notFound = (message: string) => new HttpError(404, message);

export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, message, details);

export const payloadTooLarge = (message: string, details?: unknown) =>
  new HttpError(413, message, details);

export const unsupportedMediaType = (message: string, details?: unknown) =>
  new HttpError(415, message, details);

export const tooManyRequests = (message: string, retryAfterSeconds?: number) =>
  new HttpError(
    429,
    message,
    retryAfterSeconds !== undefined
      ? { retry_after_seconds: retryAfterSeconds }
      : undefined,
  );
