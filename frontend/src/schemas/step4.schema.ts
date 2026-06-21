import { z } from "zod";

export const repairWorkSchema = z.object({
  part_name: z.string(),
  type: z.enum(["Bo'luvchi", "Bo'lmaydigan"]),
  complexity: z.enum(["BT-1", "BT-2", "BT-3"]),
  price: z.number(),
});

export const paintWorkSchema = z.object({
  part_name: z.string(),
  paint_price: z.number().min(0, "Цена покраски не может быть отрицательной"),
  polish_price: z.number().min(0, "Цена полировки не может быть отрицательной"),
});

export const sparePartSchema = z.object({
  name: z.string(),
  qty: z.number().min(1, "Количество должно быть не менее 1"),
  price: z.number().min(0, "Цена не может быть отрицательной"),
});

export const materialSchema = z.object({
  name: z.string(),
  qty: z.number().min(1, "Количество должно быть не менее 1"),
  price: z.number().min(0, "Цена не может быть отрицательной"),
});

export const step4Schema = z.object({
  hourly_rate: z
    .number({ error: "Укажите нормо-час" })
    .positive("Нормо-час должен быть больше 0"),
  repair_works: z.array(repairWorkSchema).min(1, "Добавьте минимум одну ремонтную работу"),
  paint_works: z.array(paintWorkSchema),
  spare_parts: z.array(sparePartSchema),
  materials: z.array(materialSchema),
});

export type Step4FormData = z.infer<typeof step4Schema>;
export type RepairWorkFormData = z.infer<typeof repairWorkSchema>;
export type PaintWorkFormData = z.infer<typeof paintWorkSchema>;
export type SparePartFormData = z.infer<typeof sparePartSchema>;
export type MaterialFormData = z.infer<typeof materialSchema>;
