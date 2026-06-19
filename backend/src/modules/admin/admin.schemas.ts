import { z } from 'zod';

export const templateUploadSchema = z.object({
  template: z.string().min(1, 'Template data required'),
});
