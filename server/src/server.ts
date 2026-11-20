import type { Server } from 'node:http';
import { loadEnv } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { createApp } from './app.js';
import { createLogger } from './utils/logger.js';

async function bootstrap() {
  const config = loadEnv(process.env);
  const logger = createLogger(config.LOG_LEVEL);
  const app = createApp(config, logger);

  await connectDb(config, logger);

  const server: Server = app.listen(config.PORT, () => {
    logger.info(
      `Server listening on port ${config.PORT} in ${config.NODE_ENV} mode`
    );
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDb(logger);
      process.exit(0);
    });

    // Force close after 10 seconds if connections refuse to drain
    setTimeout(() => {
      logger.error('Forced shutdown: timeout reached');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(reason, 'Unhandled promise rejection');
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    logger.error(err, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

void bootstrap();
