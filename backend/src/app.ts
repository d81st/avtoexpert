import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './common/middleware/errorHandler.js';
import { env } from './config/env.js';
import adminRoutes from './modules/admin/admin.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import expertsRoutes from './modules/experts/experts.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import { logger } from './shared/logger/logger.js';

export function buildApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN ?? true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', authRoutes);
  app.use('/api/experts', expertsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
