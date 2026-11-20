import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { createLogger, type Logger } from '../utils/logger.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function createErrorHandler(
  nodeEnv: string = 'development',
  customLogger?: Logger
) {
  const log = customLogger ?? createLogger();
  const isProd = nodeEnv === 'production';

  return function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ): void {
    // Handle known application errors
    if (err instanceof AppError) {
      const response: ErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      };
      res.status(err.statusCode).json(response);
      return;
    }

    // Handle malformed JSON body
    if (
      err instanceof SyntaxError &&
      'status' in err &&
      (err as { status?: number }).status === 400
    ) {
      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Malformed JSON payload',
        },
      });
      return;
    }

    // Handle oversized body
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Payload size exceeds allowable limit',
        },
      });
      return;
    }

    // Log unexpected errors server-side
    log.error(err, 'Unhandled server error');

    // Generic 500 response in production to avoid leaking secrets/stack traces
    const message = isProd
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

    const response: ErrorResponse = {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
      },
    };

    res.status(500).json(response);
  };
}

export const errorHandler = createErrorHandler();
