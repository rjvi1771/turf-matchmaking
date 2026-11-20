import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { AppError } from '../utils/errors.js';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface ValidationErrorDetail {
  path: string;
  message: string;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errorDetails: ValidationErrorDetail[] = [];

    // Initialize container for parsed & validated data
    if (!res.locals.validated) {
      res.locals.validated = {};
    }

    // Validate request body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
        res.locals.validated.body = result.data;
      } else {
        for (const issue of result.error.issues) {
          let pathStr = issue.path.join('.');
          if (
            !pathStr &&
            'keys' in issue &&
            Array.isArray((issue as { keys?: unknown[] }).keys)
          ) {
            pathStr = (issue as { keys: string[] }).keys.join('.');
          }
          errorDetails.push({
            path: pathStr || 'body',
            message: issue.message,
          });
        }
      }
    }

    // Validate request query
    // Note: In Express 5, req.query is a read-only getter on the request prototype.
    // Mutating req.query directly throws TypeError. We store parsed/coerced query data
    // in res.locals.validated.query for type-safe downstream consumption.
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        res.locals.validated.query = result.data;
      } else {
        for (const issue of result.error.issues) {
          errorDetails.push({
            path: issue.path.join('.') || 'query',
            message: issue.message,
          });
        }
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        res.locals.validated.params = result.data;
      } else {
        for (const issue of result.error.issues) {
          errorDetails.push({
            path: issue.path.join('.') || 'params',
            message: issue.message,
          });
        }
      }
    }

    if (errorDetails.length > 0) {
      next(
        new AppError(422, 'VALIDATION_ERROR', 'Validation failed', errorDetails)
      );
      return;
    }

    next();
  };
}
