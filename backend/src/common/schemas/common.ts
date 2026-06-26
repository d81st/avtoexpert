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

/**
 * PostgreSQL `integer` column constraint (signed 32-bit).
 *
 * Mirrors the storage capacity of `integer` columns in the schema so input
 * that exceeds the range is rejected at validation rather than crashing the
 * driver with `22003 numeric_value_out_of_range`.
 */
export const int32NonNeg = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(2_147_483_647, 'Значение превышает допустимый диапазон');

/**
 * PostgreSQL `bigint` column constraint, capped at `Number.MAX_SAFE_INTEGER`.
 *
 * The DB column itself supports values up to 2^63-1, but the application
 * deserialises bigint values as JS `number` (`mode: 'number'` in the Drizzle
 * schema), so we cap at `MAX_SAFE_INTEGER` to avoid lossy round-trips.
 */
export const int53NonNeg = z.coerce
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER, 'Значение превышает допустимый диапазон');
