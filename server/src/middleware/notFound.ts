import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function notFound(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  next(
    new AppError(
      404,
      'NOT_FOUND',
      `Route ${req.method} ${req.originalUrl} not found`
    )
  );
}
