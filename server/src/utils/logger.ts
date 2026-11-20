import pino, { type Logger } from 'pino';

export type { Logger };

export function createLogger(level: string = 'info'): Logger {
  return pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'headers.authorization',
        'headers.cookie',
        'headers["set-cookie"]',
        'authorization',
        'cookie',
        'set-cookie',
      ],
      remove: true,
    },
  });
}

export const logger: Logger = createLogger();
