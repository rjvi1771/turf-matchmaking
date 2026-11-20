import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createGlobalLimiter,
  createAuthLimiter,
  isHealthEndpoint,
} from '../src/middleware/rateLimit.js';
import { healthRouter } from '../src/routes/health.js';

describe('Rate Limiting Enforcement', () => {
  it('configured max is respected (max 3 returns 429 on the 4th request)', async () => {
    const app = express();
    const limiter = createGlobalLimiter({
      RATE_LIMIT_MAX: 3,
      RATE_LIMIT_WINDOW_MINUTES: 15,
    });
    app.use(limiter);
    app.get('/api/v1/resource', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // 1st request: 200
    const res1 = await request(app).get('/api/v1/resource');
    expect(res1.status).toBe(200);

    // 2nd request: 200
    const res2 = await request(app).get('/api/v1/resource');
    expect(res2.status).toBe(200);

    // 3rd request: 200
    const res3 = await request(app).get('/api/v1/resource');
    expect(res3.status).toBe(200);

    // 4th request: 429 TOO_MANY_REQUESTS
    const res4 = await request(app).get('/api/v1/resource');
    expect(res4.status).toBe(429);
    expect(res4.body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later',
      },
    });
  });

  it('a normal response includes standard rate limit headers, and a 429 response includes Retry-After', async () => {
    const app = express();
    const limiter = createGlobalLimiter({
      RATE_LIMIT_MAX: 1,
      RATE_LIMIT_WINDOW_MINUTES: 15,
    });
    app.use(limiter);
    app.get('/api/v1/resource', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Normal response (200)
    const normalRes = await request(app).get('/api/v1/resource');
    expect(normalRes.status).toBe(200);
    expect(normalRes.headers['ratelimit-limit']).toBe('1');
    expect(normalRes.headers['ratelimit-remaining']).toBe('0');
    expect(normalRes.headers['ratelimit-reset']).toBeDefined();

    // 429 response
    const blockedRes = await request(app).get('/api/v1/resource');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers['retry-after']).toBeDefined();
    expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);
    expect(blockedRes.headers['ratelimit-limit']).toBe('1');
    expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
  });

  it('exact match health exemption: /api/v1/health and /api/v1/health/ (trailing slash) stay 200 while /api/v1/healthx is rate limited', async () => {
    const app = express();
    const limiter = createGlobalLimiter({
      RATE_LIMIT_MAX: 3,
      RATE_LIMIT_WINDOW_MINUTES: 15,
    });
    app.use(limiter);
    app.use('/api/v1', healthRouter);
    app.get('/api/v1/normal-route', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Exhaust quota on normal route (3 requests)
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/api/v1/normal-route');
      expect(res.status).toBe(200);
    }

    // Normal route is now exhausted and returns 429
    const blockedRes = await request(app).get('/api/v1/normal-route');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');

    // 1. Exact match /api/v1/health remains accessible (200)
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ status: 'ok' });

    // 2. Trailing slash /api/v1/health/ is allowed and remains accessible (200)
    const healthTrailingSlashRes = await request(app).get('/api/v1/health/');
    expect(healthTrailingSlashRes.status).toBe(200);
    expect(healthTrailingSlashRes.body).toEqual({ status: 'ok' });

    // 3. Query string ignored /api/v1/health?check=quick remains accessible (200)
    const healthQueryRes = await request(app).get('/api/v1/health?check=quick');
    expect(healthQueryRes.status).toBe(200);
    expect(healthQueryRes.body).toEqual({ status: 'ok' });

    // 4. /api/v1/healthx is NOT exempt: exact match required (no startsWith); returns 429
    const healthxRes = await request(app).get('/api/v1/healthx');
    expect(healthxRes.status).toBe(429);
    expect(healthxRes.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('isHealthEndpoint helper accurately distinguishes exact health routes from prefixes', () => {
    // Exact matches
    expect(isHealthEndpoint('/api/v1/health')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health/')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health?foo=bar')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health/?foo=bar')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health/ready')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health/ready/')).toBe(true);
    expect(isHealthEndpoint('/api/v1/health/ready?verbose=true')).toBe(true);

    // Disallowed prefixes or sub-routes
    expect(isHealthEndpoint('/api/v1/healthx')).toBe(false);
    expect(isHealthEndpoint('/api/v1/healthy')).toBe(false);
    expect(isHealthEndpoint('/api/v1/health/extra')).toBe(false);
    expect(isHealthEndpoint('/api/v1/health/readyx')).toBe(false);
    expect(isHealthEndpoint('/api/v1/health/ready/deep')).toBe(false);
    expect(isHealthEndpoint('/health')).toBe(false);
  });

  it('successful auth requests do not count against the auth limiter, failed ones do', async () => {
    const app = express();
    app.use(express.json());
    // authLimiter has skipSuccessfulRequests: true
    const limiter = createAuthLimiter({ max: 5 });

    app.post('/api/v1/auth/login', limiter, (req, res) => {
      const { password } = req.body || {};
      if (password === 'correct-password') {
        res.status(200).json({ token: 'mock-jwt-token' });
      } else {
        res.status(401).json({ error: 'invalid credentials' });
      }
    });

    // 10 successful authentication requests (exceeding max 5)
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'correct-password' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ token: 'mock-jwt-token' });
    }

    // 5 failed authentication requests (exhausts max: 5)
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // 6th failed request triggers 429
    const blockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'wrong-password' });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body).toEqual({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts, please try again later',
      },
    });
  });
});
