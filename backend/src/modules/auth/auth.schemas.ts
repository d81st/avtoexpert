import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().trim().min(1),
  password: z.string().min(1),
});

export const createExpertSchema = z.object({
  full_name: z.string().trim().min(1, 'Имя эксперта обязательно').max(255),
});

export const updateExpertSchema = z.object({
  full_name: z.string().trim().min(1, 'Имя эксперта обязательно').max(255),
});

export const expertParamsSchema = z.object({
  id: z.uuid(),
});
