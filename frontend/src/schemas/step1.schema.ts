import { z } from 'zod';

export const step1Schema = z.object({
  expert_id: z.string().min(1, 'Выберите эксперта'),
  report_number: z.string().min(1, 'Введите номер заключения'),
  report_date: z.string().min(1, 'Выберите дату заключения'),
  application_date: z.string().min(1, 'Выберите дату подачи заявки'),
});

export type Step1FormData = z.infer<typeof step1Schema>;
