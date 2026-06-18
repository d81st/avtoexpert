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
