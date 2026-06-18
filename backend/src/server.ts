import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger/logger.js';

const app = buildApp();

app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
  logger.info(`Environment: ${env.NODE_ENV}`);
});
