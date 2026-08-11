import { Router } from 'express';
import { healthService } from '../services/health.service.js';

const router = Router();

router.get('/health', (_req, res) => {
  const healthData = healthService.getHealthStatus();
  res.status(200).json(healthData);
});

export default router;
