import { z } from 'zod';

export const expertSchema = z.object({
  full_name: z
    .string()
    .min(1, 'Введите ФИО эксперта')
    .min(3, 'ФИО должно содержать минимум 3 символа'),
});

export type ExpertFormData = z.infer<typeof expertSchema>;
