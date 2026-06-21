import { z } from "zod";

export const step3Schema = z.object({
  production_status: z.enum(["В производстве", "Снят с производства"], {
    error: "Выберите статус производства",
  }),
  analog1_mileage: z
    .number({ error: "Укажите пробег аналога 1" })
    .min(0, "Пробег не может быть отрицательным"),
  analog1_price: z
    .number({ error: "Укажите цену аналога 1" })
    .min(0, "Цена не может быть отрицательной"),
  analog2_mileage: z
    .number({ error: "Укажите пробег аналога 2" })
    .min(0, "Пробег не может быть отрицательным"),
  analog2_price: z
    .number({ error: "Укажите цену аналога 2" })
    .min(0, "Цена не может быть отрицательной"),
  analog3_mileage: z
    .number({ error: "Укажите пробег аналога 3" })
    .min(0, "Пробег не может быть отрицательным"),
  analog3_price: z
    .number({ error: "Укажите цену аналога 3" })
    .min(0, "Цена не может быть отрицательной"),
  factory_price: z.number().optional(),
  depreciation_pct: z.number({ error: "Выберите % износа" }),
});

export type Step3FormData = z.infer<typeof step3Schema>;
