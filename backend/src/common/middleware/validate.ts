import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
import { badRequest } from '../errors/httpError.js';

type RequestSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

export const validate =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // Express 5 makes req.query a read-only getter.
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          configurable: true,
        });
      }
      next();
    } catch (error) {
      next(badRequest('Validation error', error));
    }
  };
