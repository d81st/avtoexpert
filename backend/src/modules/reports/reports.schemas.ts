import { z } from 'zod';
import {
  int32NonNeg,
  int53NonNeg,
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
  // `car_year`, `mileage`, `mileage_by_method` are stored as Postgres `integer`
  // (signed 32-bit). Use the int32-bounded helper so values outside the range
  // are rejected at validation rather than at the DB driver (22003).
  carYear: int32NonNeg.optional(),
  carColor: optionalString,
  bodyType: optionalString,
  licensePlate: optionalString,
  ownerName: optionalString,
  techPassport: optionalString,
  techPassportPlace: optionalString,
  mileage: int32NonNeg.optional(),
  odometerStatus: optionalString,
  mileageByMethod: int32NonNeg.optional(),
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

export const step3Schema = z.object({
  productionStatus: optionalString,
  // analog mileage columns are `integer` (int32); prices are `bigint`.
  analog1Mileage: int32NonNeg.optional(),
  analog1Price: int53NonNeg.optional(),
  analog2Mileage: int32NonNeg.optional(),
  analog2Price: int53NonNeg.optional(),
  analog3Mileage: int32NonNeg.optional(),
  analog3Price: int53NonNeg.optional(),
  factoryPrice: int53NonNeg.optional(),
  depreciationPct: z.coerce.number().int().min(0).max(100).optional(),
});

// Step 4 prices are stored as `bigint`; `qty` and `hourly_rate` as `integer`.
const repairWorkSchema = z.object({
  part_name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  complexity: z.string().trim().min(1),
  price: int53NonNeg,
});

const paintWorkSchema = z.object({
  part_name: z.string().trim().min(1),
  paint_price: int53NonNeg,
  polish_price: int53NonNeg,
});

const lineItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: positiveInt.max(2_147_483_647),
  price: int53NonNeg,
});

export const step4Schema = z.object({
  hourly_rate: int32NonNeg,
  repair_works: z.array(repairWorkSchema).default([]),
  paint_works: z.array(paintWorkSchema).default([]),
  spare_parts: z.array(lineItemSchema).default([]),
  materials: z.array(lineItemSchema).default([]),
});

export const step5Schema = z.object({}).passthrough();

// Autosave payload (R2.12). `version` is an optional non-negative integer used
// for optimistic concurrency control: when the client supplies it, the server
// commits the autosave only if `reports.version` still equals that value and
// otherwise responds with HTTP 409 + `{ details: { current_version } }` so the
// client can reconcile. When `version` is omitted the autosave is forced and
// still increments the server-side version. All other fields are passed
// through to the repository, which applies its own column allow-list.
export const autosaveSchema = z
  .object({
    version: int32NonNeg.optional(),
  })
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

// PATCH /api/reports/:reportId/photos/:photoId body.
// `caption` is NFC-normalized and bounded to 200 Unicode code points (grapheme
// count via the spread operator, so combining characters are counted per code
// point). `position` is a 1..20 integer matching the per-report photo limit.
// At least one of `caption` / `position` must be present.
export const photoPatchSchema = z
  .object({
    caption: z
      .string()
      .transform((s) => s.normalize('NFC'))
      .refine((s) => [...s].length <= 200, { message: 'caption_too_long_200' })
      .nullable()
      .optional(),
    position: z
      .number()
      .int({ message: 'position_must_be_integer' })
      .min(1, { message: 'position_out_of_range' })
      .max(20, { message: 'position_out_of_range' })
      .optional(),
  })
  .refine((b) => b.caption !== undefined || b.position !== undefined, {
    message: 'empty_patch_body',
  });

export type PhotoPatch = z.infer<typeof photoPatchSchema>;

export type Step4Input = z.infer<typeof step4Schema>;
