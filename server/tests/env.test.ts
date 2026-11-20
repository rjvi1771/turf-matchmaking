import { describe, expect, it, vi } from 'vitest';
import { validateEnv } from '../src/config/env.js';

describe('Environment validation', () => {
  const validBaseEnv = {
    NODE_ENV: 'test',
    PORT: '4000',
    MONGODB_URI: 'mongodb://localhost:27017/turf_test',
    CLIENT_ORIGIN: 'http://localhost:5173,http://localhost:3000',
    TRUST_PROXY: '0',
    LOG_LEVEL: 'silent',
  };

  it('valid environment parses successfully', () => {
    const result = validateEnv(validBaseEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
      expect(result.data.CLIENT_ORIGIN).toEqual([
        'http://localhost:5173',
        'http://localhost:3000',
      ]);
      expect(result.data.RATE_LIMIT_MAX).toBe(300);
      expect(result.data.RATE_LIMIT_WINDOW_MINUTES).toBe(15);
      expect(result.data.TRUST_PROXY).toBe(0);
    }
  });

  it('missing MONGODB_URI fails, naming the variable with no secret value', () => {
    const envMissingUri = { ...validBaseEnv, MONGODB_URI: '' };
    const result = validateEnv(envMissingUri);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      const combined = result.errors.join(' ');
      expect(combined).toContain('MONGODB_URI');
      expect(combined).not.toContain('localhost:27017');
    }
  });

  it('rejects CLIENT_ORIGIN with wildcard "*"', () => {
    const envWildcard = { ...validBaseEnv, CLIENT_ORIGIN: '*' };
    const result = validateEnv(envWildcard);
    expect(result.success).toBe(false);
    if (!result.success) {
      const combined = result.errors.join(' ');
      expect(combined).toContain('CLIENT_ORIGIN');
      expect(combined).toContain('wildcard');
    }
  });

  it('rejects invalid PORT', () => {
    const envInvalidPort = { ...validBaseEnv, PORT: 'not-a-number' };
    const result = validateEnv(envInvalidPort);
    expect(result.success).toBe(false);
    if (!result.success) {
      const combined = result.errors.join(' ');
      expect(combined).toContain('PORT');
    }
  });

  it('rejects out-of-range PORT', () => {
    const envOutRangePort = { ...validBaseEnv, PORT: '70000' };
    const result = validateEnv(envOutRangePort);
    expect(result.success).toBe(false);
    if (!result.success) {
      const combined = result.errors.join(' ');
      expect(combined).toContain('PORT');
    }
  });

  it('production env without TRUST_PROXY fails naming only the variable', () => {
    const prodWithoutTrustProxy = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      TRUST_PROXY: undefined,
    };
    const result = validateEnv(prodWithoutTrustProxy);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBe(1);
      const err = result.errors[0];
      expect(err).toBe(
        'TRUST_PROXY: TRUST_PROXY must be set explicitly in production'
      );
      expect(err).not.toContain('undefined');
      expect(err).not.toContain('null');
    }
  });

  it('production env with TRUST_PROXY=1 passes', () => {
    const prodWithTrustProxy = {
      ...validBaseEnv,
      NODE_ENV: 'production',
      TRUST_PROXY: '1',
    };
    const result = validateEnv(prodWithTrustProxy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRUST_PROXY).toBe(1);
    }
  });

  it('development and test default TRUST_PROXY to 0 when omitted', () => {
    const devWithoutTrustProxy = {
      ...validBaseEnv,
      NODE_ENV: 'development',
      TRUST_PROXY: undefined,
    };
    const result = validateEnv(devWithoutTrustProxy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TRUST_PROXY).toBe(0);
    }
  });

  it('custom RATE_LIMIT_MAX and RATE_LIMIT_WINDOW_MINUTES are parsed correctly', () => {
    const customRateEnv = {
      ...validBaseEnv,
      RATE_LIMIT_MAX: '500',
      RATE_LIMIT_WINDOW_MINUTES: '30',
    };
    const result = validateEnv(customRateEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_MAX).toBe(500);
      expect(result.data.RATE_LIMIT_WINDOW_MINUTES).toBe(30);
    }
  });

  describe('invalid values fail validation', () => {
    it('rejects invalid NODE_ENV', () => {
      const result = validateEnv({ ...validBaseEnv, NODE_ENV: 'staging' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('NODE_ENV');
      }
    });

    it('rejects invalid MONGODB_URI protocol', () => {
      const result = validateEnv({
        ...validBaseEnv,
        MONGODB_URI: 'postgres://localhost:5432/turf',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('MONGODB_URI');
      }
    });

    it('rejects invalid LOG_LEVEL', () => {
      const result = validateEnv({ ...validBaseEnv, LOG_LEVEL: 'verbose' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('LOG_LEVEL');
      }
    });

    it('rejects non-positive RATE_LIMIT_MAX', () => {
      const result = validateEnv({ ...validBaseEnv, RATE_LIMIT_MAX: '0' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('RATE_LIMIT_MAX');
      }
    });

    it('rejects non-positive RATE_LIMIT_WINDOW_MINUTES', () => {
      const result = validateEnv({
        ...validBaseEnv,
        RATE_LIMIT_WINDOW_MINUTES: '-5',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('RATE_LIMIT_WINDOW_MINUTES');
      }
    });

    it('rejects negative TRUST_PROXY', () => {
      const result = validateEnv({ ...validBaseEnv, TRUST_PROXY: '-1' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.join(' ')).toContain('TRUST_PROXY');
      }
    });
  });

  it('importing the config and app modules with an empty process.env does not call process.exit', async () => {
    const originalEnv = process.env;
    process.env = {};
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);

    try {
      const envModule = await import('../src/config/env.js');
      expect(envModule.validateEnv).toBeDefined();
      expect(envModule.loadEnv).toBeDefined();

      const appModule = await import('../src/app.js');
      expect(appModule.createApp).toBeDefined();

      const loggerModule = await import('../src/utils/logger.js');
      expect(loggerModule.createLogger).toBeDefined();

      const rateLimitModule = await import('../src/middleware/rateLimit.js');
      expect(rateLimitModule.createGlobalLimiter).toBeDefined();

      const errorHandlerModule =
        await import('../src/middleware/errorHandler.js');
      expect(errorHandlerModule.createErrorHandler).toBeDefined();

      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      process.env = originalEnv;
    }
  });
});
