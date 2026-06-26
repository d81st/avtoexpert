import { z } from 'zod';

// PostgreSQL `integer` (signed 32-bit) hard ceiling. Values above this
// overflow on the backend with `22003 numeric_value_out_of_range`; cap them
// at the form layer so the user sees a friendly validation error instead.
const PG_INT32_MAX = 2_147_483_647;
const TOO_LARGE = 'Значение превышает допустимый диапазон';

export const step2Schema = z.object({
  // 2.1 — Данные автомобиля
  car_model: z.string().min(1, 'Укажите модель автомобиля'),
  car_year: z.number({ error: 'Выберите год выпуска' }),
  car_color: z.string().min(1, 'Укажите цвет'),
  body_type: z.string().min(1, 'Выберите тип кузова'),
  license_plate: z.string().min(1, 'Укажите госномер'),

  // 2.2 — Данные владельца
  owner_name: z.string().min(1, 'Укажите Ф.И.О. владельца'),
  tech_passport: z.string().min(1, 'Укажите номер техпаспорта'),
  tech_passport_place: z.string().optional(),

  // 2.3 — Технические данные
  mileage: z
    .number({ error: 'Укажите показания одометра' })
    .positive('Укажите показания одометра')
    .max(PG_INT32_MAX, TOO_LARGE),
  odometer_status: z.enum(['Исправен', 'Неисправен'], {
    error: 'Выберите статус одометра',
  }),
  mileage_by_method: z
    .number()
    .nonnegative('Пробег не может быть отрицательным')
    .max(PG_INT32_MAX, TOO_LARGE)
    .optional(),
  vin_code: z.string().min(1, 'Укажите VIN-код').length(17, 'VIN должен содержать 17 символов'),
  engine_number: z.string().optional(),

  // 2.4 — Внешний осмотр
  transmission_type: z.string().min(1, 'Выберите тип трансмиссии'),
  camera_model: z.string().optional(),
  passport_match: z.boolean(),
});

export type Step2FormData = z.infer<typeof step2Schema>;
