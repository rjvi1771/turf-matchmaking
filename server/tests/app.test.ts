import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Router } from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { validateEnv, type Env } from '../src/config/env.js';
import { validate } from '../src/middleware/validate.js';
import { notFound } from '../src/middleware/notFound.js';
import { createErrorHandler } from '../src/middleware/errorHandler.js';
import { registerSchema } from '@turf-matchmaking/shared';

// Fixture helper to build valid typed Env configs via validateEnv
function createTestConfig(
  overrides: Record<string, string | undefined> = {}
): Env {
  const baseFixture = {
    NODE_ENV: 'test',
    PORT: '4000',
    MONGODB_URI: 'mongodb://localhost:27017/turf_test',
    CLIENT_ORIGIN: 'http://localhost:5173,http://localhost:3000',
    TRUST_PROXY: '0',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: '300',
    RATE_LIMIT_WINDOW_MINUTES: '15',
  };

  const result = validateEnv({ ...baseFixture, ...overrides });
  if (!result.success) {
    throw new Error(`Invalid test env fixture: ${result.errors.join(', ')}`);
  }
  return result.data;
}

describe('Server Application Integration Tests', () => {
  let mongod: MongoMemoryServer;

  const testConfig = createTestConfig();
  // createApp(testConfig) is the pristine production application (no test routes in src/)
  const app = createApp(testConfig);

  // Test-only Express app mounted locally in the test file for middleware verification
  const testRouter = Router();

  testRouter.post(
    '/validate-register',
    validate({ body: registerSchema }),
    (_req, res) => {
      res.status(200).json({ success: true });
    }
  );

  testRouter.get('/throw-error', () => {
    throw new Error('secret detail');
  });

  testRouter.post('/echo', (req, res) => {
    res.status(200).json(req.body);
  });

  const testApp = express();
  testApp.use(express.json({ limit: '10kb' }));
  testApp.use('/api/v1/test', testRouter);
  testApp.use(notFound);
  testApp.use(createErrorHandler('test'));

  beforeAll(async () => {
    // Pin to MongoDB 8.0.4 binary in .mongodb-binaries
    const candidates = [
      path.resolve(
        process.cwd(),
        '.mongodb-binaries/mongod-x64-win32-8.0.4.exe'
      ),
      path.resolve(
        process.cwd(),
        '../.mongodb-binaries/mongod-x64-win32-8.0.4.exe'
      ),
    ];
    const binaryPath = candidates.find((p) => fs.existsSync(p));

    mongod = await MongoMemoryServer.create({
      binary: binaryPath
        ? { systemBinary: binaryPath, version: '8.0.4' }
        : { version: '8.0.4' },
    });
  });

  afterAll(async () => {
    await disconnectDb();
    if (mongod) {
      await mongod.stop();
    }
  });

  describe('Health Probes', () => {
    it('liveness /api/v1/health returns 200 with exact shape { status: "ok" } and no version leak', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res.body.version).toBeUndefined();
      expect(res.body.env).toBeUndefined();
    });

    it('readiness /api/v1/health/ready returns 503 before database is connected', async () => {
      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Database not connected',
        },
      });
    });

    it('readiness /api/v1/health/ready returns 200 after connecting to MongoDB', async () => {
      const uri = mongod.getUri();
      await connectDb(uri);

      const res = await request(app).get('/api/v1/health/ready');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ready' });
    });
  });

  describe('Database and sanitizeFilter Enforcement', () => {
    it('sanitizeFilter prevents NoSQL operator object injection on queries', async () => {
      const testSchema = new mongoose.Schema({
        name: mongoose.Schema.Types.Mixed,
      });
      const TestModel =
        mongoose.models.TestModel || mongoose.model('TestModel', testSchema);

      await TestModel.deleteMany({});
      await TestModel.create({ name: 'Alice' });

      // With sanitizeFilter, { name: { $ne: null } } is wrapped in $eq and does NOT match 'Alice'
      const sanitizedQuery = mongoose.sanitizeFilter({ name: { $ne: null } });
      expect(sanitizedQuery).toEqual({ name: { $eq: { $ne: null } } });

      const found = await TestModel.find(
        sanitizedQuery as Parameters<typeof TestModel.find>[0]
      );
      expect(found.length).toBe(0);
    });
  });

  describe('Routing and Error Handling', () => {
    it('unknown route returns 404 in standard error shape', async () => {
      const res = await request(app).get('/api/v1/non-existent-route');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toEqual({
        code: 'NOT_FOUND',
        message: expect.stringContaining(
          'Route GET /api/v1/non-existent-route not found'
        ),
      });
    });

    it('malformed JSON body returns 400 with standard error shape', async () => {
      const res = await request(testApp)
        .post('/api/v1/test/echo')
        .set('Content-Type', 'application/json')
        .send('{"invalidJson":');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'BAD_REQUEST',
          message: 'Malformed JSON payload',
        },
      });
    });

    it('oversized body (>10kb limit) returns 413 with standard error shape', async () => {
      const largePayload = { data: 'x'.repeat(12 * 1024) }; // ~12kb

      const res = await request(testApp)
        .post('/api/v1/test/echo')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body).toEqual({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Payload size exceeds allowable limit',
        },
      });
    });

    it('route throwing Error("secret detail") returns 500 with generic message and no stack or secret in production', async () => {
      const prodErrorApp = express();
      prodErrorApp.use('/test/error', () => {
        throw new Error('secret detail');
      });
      prodErrorApp.use(createErrorHandler('production'));

      const res = await request(prodErrorApp).get('/test/error');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      });
      expect(JSON.stringify(res.body)).not.toContain('secret detail');
      expect(res.body.error.stack).toBeUndefined();
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('helmet headers are present and x-powered-by is absent', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('CORS Enforcement', () => {
    it('allowed origin receives matching access-control-allow-origin and credentials true', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:5173'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('disallowed origin receives no access-control-allow-origin header', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://unauthorized-attacker.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Validate Middleware (Integration with Shared Schemas)', () => {
    it('valid registration payload passes validation', async () => {
      const res = await request(testApp)
        .post('/api/v1/test/validate-register')
        .send({
          name: 'Vijay Player',
          email: 'vijay@example.com',
          password: 'securepassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });

    it('rejects unknown injected fields (e.g. isAdmin) with 422 and path details', async () => {
      const res = await request(testApp)
        .post('/api/v1/test/validate-register')
        .send({
          name: 'Attacker',
          email: 'attacker@example.com',
          password: 'securepassword123',
          isAdmin: true,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'isAdmin' })])
      );
      // Ensure no submitted value is leaked in error details
      expect(JSON.stringify(res.body.error.details)).not.toContain('true');
    });

    it('rejects NoSQL operator object { "$gt": "" } as email with 422', async () => {
      const res = await request(testApp)
        .post('/api/v1/test/validate-register')
        .send({
          name: 'NoSQL Injector',
          email: { $gt: '' },
          password: 'securepassword123',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'email' })])
      );
      // Ensure no submitted value is leaked in error details
      expect(JSON.stringify(res.body.error.details)).not.toContain('$gt');
    });
  });
});
