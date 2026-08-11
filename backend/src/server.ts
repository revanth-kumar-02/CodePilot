import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import healthRouter from './routes/health.router.js';
import aiRouter from './routes/ai.router.js';

export const createApp = (): express.Application => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Mount API routes
  app.use('/api', healthRouter);
  app.use('/api/ai', aiRouter);

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  return app;
};

const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}
