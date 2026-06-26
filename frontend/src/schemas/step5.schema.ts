import { z } from 'zod';

export const reportPhotoSchema = z.object({
  id: z.string(),
  url: z.string(),
  file_path: z.string().optional(),
});

export const step5Schema = z.object({
  photos: z.array(reportPhotoSchema),
});

export type Step5FormData = z.infer<typeof step5Schema>;
export type ReportPhotoFormData = z.infer<typeof reportPhotoSchema>;
