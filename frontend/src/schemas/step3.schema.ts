import { z } from 'zod';

// PostgreSQL constraints: analog mileage = `integer` (int32),
// price columns = `bigint` deserialised as JS number (capped at MAX_SAFE_INTEGER).
const PG_INT32_MAX = 2_147_483_647;
const PG_INT53_MAX = Number.MAX_SAFE_INTEGER;
const TOO_LARGE = 'Значение превышает допустимый диапазон';

export const step3Schema = z.object({
  production_status: z.enum(['В производстве', 'Снят с производства'], {
    error: 'Выберите статус производства',
  }),
  analog1_mileage: z
    .number({ error: 'Укажите пробег аналога 1' })
    .min(0, 'Пробег не может быть отрицательным')
    .max(PG_INT32_MAX, TOO_LARGE),
  analog1_price: z
    .number({ error: 'Укажите цену аналога 1' })
    .min(0, 'Цена не может быть отрицательной')
    .max(PG_INT53_MAX, TOO_LARGE),
  analog2_mileage: z
    .number({ error: 'Укажите пробег аналога 2' })
    .min(0, 'Пробег не может быть отрицательным')
    .max(PG_INT32_MAX, TOO_LARGE),
  analog2_price: z
    .number({ error: 'Укажите цену аналога 2' })
    .min(0, 'Цена не может быть отрицательной')
    .max(PG_INT53_MAX, TOO_LARGE),
  analog3_mileage: z
    .number({ error: 'Укажите пробег аналога 3' })
    .min(0, 'Пробег не может быть отрицательным')
    .max(PG_INT32_MAX, TOO_LARGE),
  analog3_price: z
    .number({ error: 'Укажите цену аналога 3' })
    .min(0, 'Цена не может быть отрицательной')
    .max(PG_INT53_MAX, TOO_LARGE),
  factory_price: z.number().min(0).max(PG_INT53_MAX, TOO_LARGE).optional(),
  depreciation_pct: z.number({ error: 'Выберите % износа' }),
});

export type Step3FormData = z.infer<typeof step3Schema>;
