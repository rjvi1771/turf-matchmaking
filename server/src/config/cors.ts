import { CorsOptions } from 'cors';

export type CorsConfig = string[] | { CLIENT_ORIGIN: string[] };

export function createCorsOptions(originsOrConfig: CorsConfig): CorsOptions {
  const allowedOrigins = Array.isArray(originsOrConfig)
    ? originsOrConfig
    : originsOrConfig.CLIENT_ORIGIN;

  return {
    origin: (origin, callback) => {
      // Allow requests with no Origin header (health checks, server-to-server, curl)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Disallowed origin: return false so no allow-origin header is set
      return callback(null, false);
    },
    credentials: true,
  };
}
