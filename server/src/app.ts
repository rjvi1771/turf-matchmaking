import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env.js';
import { createCorsOptions } from './config/cors.js';
import { createGlobalLimiter } from './middleware/rateLimit.js';
import { notFound } from './middleware/notFound.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { createLogger, type Logger } from './utils/logger.js';

export function createApp(config: Env, customLogger?: Logger): Express {
  const app = express();
  const logger = customLogger ?? createLogger(config.LOG_LEVEL);

  // Trust proxy hops configuration:
  // Behind reverse proxies (e.g. Render load balancers, Vercel edge rewrite proxies),
  // req.ip without trust proxy defaults to the proxy's internal IP. This causes rate limiters
  // to group all users into one bucket and trigger false 429 errors. Setting trust proxy
  // instructs Express to accurately resolve the client IP from X-Forwarded-For based on trusted hops.
  app.set('trust proxy', config.TRUST_PROXY);

  // 1. Security headers
  app.use(helmet());

  // 2. CORS configuration with exact origin matching and credentials
  app.use(cors(createCorsOptions(config.CLIENT_ORIGIN)));

  // 3. Global rate limiter
  app.use(createGlobalLimiter(config));

  // 4. JSON body parser with strict size limit
  app.use(express.json({ limit: '10kb' }));

  // 5. Cookie parser
  app.use(cookieParser());

  // 6. HTTP request logging (redacts authorization and cookie headers)
  if (config.LOG_LEVEL !== 'silent') {
    app.use(pinoHttp({ logger }));
  }

  // 7. Routes
  app.use('/api/v1', healthRouter);

  // 8. 404 handler
  app.use(notFound);

  // 9. Uniform error handler
  app.use(createErrorHandler(config.NODE_ENV, logger));

  return app;
}
