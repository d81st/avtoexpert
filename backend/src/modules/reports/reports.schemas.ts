import { z } from 'zod';
import {
  nonNegativeInt,
  optionalString,
  positiveInt,
} from '../../common/schemas/common.js';

// VIN код: ровно 17 символов, только A-Z и 0-9 (без I, O, Q)
const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;

export const createReportSchema = z.object({
  expert_id: z.uuid(),
  report_number: z.string().trim().min(1),
  report_date: z.coerce.date(),
  application_date: z.coerce.date(),
});

export const step2Schema = z.object({
  carModel: optionalString,
  carYear: nonNegativeInt.optional(),
  carColor: optionalString,
  bodyType: optionalString,
  licensePlate: optionalString,
  ownerName: optionalString,
  techPassport: optionalString,
  techPassportPlace: optionalString,
  mileage: nonNegativeInt.optional(),
  odometerStatus: optionalString,
  mileageByMethod: nonNegativeInt.optional(),
  vinCode: z
    .string()
    .trim()
    .regex(
      vinRegex,
      'VIN должен содержать ровно 17 символов (A-Z, 0-9, без I, O, Q)',
    )
    .optional()
    .or(z.literal('')),
  engineNumber: optionalString,
  transmissionType: optionalString,
  cameraModel: optionalString,
  passportMatch: z.boolean().optional(),
});

// PostgreSQL integer max = 2^31-1; bigint fields allow larger values
const pgInteger = z.coerce.number().int().nonnegative().max(2_147_483_647);
const pgBigint = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const step3Schema = z.object({
  productionStatus: optionalString,
  analog1Mileage: pgInteger.optional(),
  analog1Price: pgBigint.optional(),
  analog2Mileage: pgInteger.optional(),
  analog2Price: pgBigint.optional(),
  analog3Mileage: pgInteger.optional(),
  analog3Price: pgBigint.optional(),
  factoryPrice: pgBigint.optional(),
  depreciationPct: z.coerce.number().int().min(0).max(100).optional(),
});

const repairWorkSchema = z.object({
  part_name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  complexity: z.string().trim().min(1),
  price: nonNegativeInt,
});

const paintWorkSchema = z.object({
  part_name: z.string().trim().min(1),
  paint_price: nonNegativeInt,
  polish_price: nonNegativeInt,
});

const lineItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: positiveInt,
  price: nonNegativeInt,
});

export const step4Schema = z.object({
  hourly_rate: nonNegativeInt,
  repair_works: z.array(repairWorkSchema).default([]),
  paint_works: z.array(paintWorkSchema).default([]),
  spare_parts: z.array(lineItemSchema).default([]),
  materials: z.array(lineItemSchema).default([]),
});

export const step5Schema = z.object({}).passthrough();

export const autosaveSchema = z
  .object({})
  .passthrough()
  .refine(
    (value) => Object.keys(value).length > 0,
    'Autosave payload is empty',
  );

export const reportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['draft', 'completed']).optional(),
});

export type Step4Input = z.infer<typeof step4Schema>;
