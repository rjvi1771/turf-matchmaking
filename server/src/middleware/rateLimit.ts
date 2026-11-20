import rateLimit, { type Options } from 'express-rate-limit';

export interface RateLimitConfig {
  RATE_LIMIT_WINDOW_MINUTES: number;
  RATE_LIMIT_MAX: number;
}

/**
 * Exact match health check exemption:
 * Matches '/api/v1/health' and '/api/v1/health/ready' exactly.
 * Allows trailing slash (e.g. '/api/v1/health/') and strips query string.
 * Disallows prefix matches like '/api/v1/healthx'.
 */
export function isHealthEndpoint(urlPath: string): boolean {
  const [pathname = ''] = urlPath.split('?');
  const normalized =
    pathname.endsWith('/') && pathname.length > 1
      ? pathname.slice(0, -1)
      : pathname;

  return (
    normalized === '/api/v1/health' || normalized === '/api/v1/health/ready'
  );
}

export function createGlobalLimiter(
  config?: Partial<RateLimitConfig>,
  customOptions: Partial<Options> = {}
) {
  const windowMs = (config?.RATE_LIMIT_WINDOW_MINUTES ?? 15) * 60 * 1000;
  const max = config?.RATE_LIMIT_MAX ?? 300;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const fullPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
      return isHealthEndpoint(fullPath);
    },
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later',
      },
    },
    ...customOptions,
  });
}

export function createAuthLimiter(customOptions: Partial<Options> = {}) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts, please try again later',
      },
    },
    ...customOptions,
  });
}

export const authLimiter = createAuthLimiter();
