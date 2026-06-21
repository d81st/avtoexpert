import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../shared/logger/logger.js';
import { HttpError } from '../errors/httpError.js';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    const details =
      error.details instanceof ZodError
        ? error.details.flatten()
        : error.details;

    res.status(error.statusCode).json({
      error: error.message,
      ...(details && Object.keys(details as object).length > 0
        ? { details }
        : {}),
    });
    return;
  }

  logger.error('Unhandled request error', error);
  res.status(500).json({ error: 'Internal server error' });
};
