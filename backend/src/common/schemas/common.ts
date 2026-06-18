import { z } from 'zod';

export const uuidParamsSchema = z.object({
  id: z.uuid(),
});

export const photoParamsSchema = z.object({
  id: z.uuid(),
  photoId: z.uuid(),
});

export const optionalString = z.string().trim().optional();

export const positiveInt = z.coerce.number().int().positive();

export const nonNegativeInt = z.coerce.number().int().nonnegative();
