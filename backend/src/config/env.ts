import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  TEMPLATE_DIR: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

const uploadDir =
  parsed.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');
const templateDir =
  parsed.TEMPLATE_DIR ?? path.resolve(process.cwd(), 'templates');

export const env = {
  ...parsed,
  UPLOAD_DIR: uploadDir,
  TEMPLATE_DIR: templateDir,
  PHOTOS_DIR: path.join(uploadDir, 'photos'),
};
