import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

// Liveness probe: returns 200 without exposing version or environment details
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe: returns 200 only if database connection is active, otherwise 503
healthRouter.get('/health/ready', (_req: Request, res: Response) => {
  if (mongoose.connection.readyState === 1) {
    res.status(200).json({ status: 'ready' });
    return;
  }

  res.status(503).json({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Database not connected',
    },
  });
});
