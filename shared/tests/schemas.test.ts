import { describe, expect, it } from 'vitest';
import {
  availabilityQuerySchema,
  createBookingSchema,
  createTurfSchema,
  loginSchema,
  registerSchema,
  updateTurfSchema,
} from '../src/index.js';

describe('Schema validation test suite', () => {
  const validTurfId = '507f1f77bcf86cd799439011';

  describe('every schema passes with valid input', () => {
    it('registerSchema accepts valid input (default player role)', () => {
      const result = registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'securepassword123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('player');
        expect(result.data.email).toBe('john@example.com');
      }
    });

    it('registerSchema accepts valid input with explicit owner role', () => {
      const result = registerSchema.safeParse({
        name: 'Jane Owner',
        email: 'jane@example.com',
        password: 'securepassword123',
        role: 'owner',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('owner');
      }
    });

    it('loginSchema accepts valid input', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('createTurfSchema accepts valid input', () => {
      const result = createTurfSchema.safeParse({
        name: 'Green Field Arena',
        city: 'Mumbai',
        address: '123 Turf Road, Andheri West',
        sports: ['football', 'cricket'],
        pricePerSlotPaise: 150000,
        openTime: '06:00',
        closeTime: '23:00',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.slotMinutes).toBe(60);
      }
    });

    it('updateTurfSchema accepts partial valid input', () => {
      const result = updateTurfSchema.safeParse({
        city: 'Navi Mumbai',
        pricePerSlotPaise: 180000,
      });
      expect(result.success).toBe(true);
    });

    it('createBookingSchema accepts valid input', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(true);
    });

    it('availabilityQuerySchema accepts valid input', () => {
      const result = availabilityQuerySchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('unknown extra fields are rejected (.strict() enforcement)', () => {
    it('registerSchema rejects unknown fields (e.g. isAdmin)', () => {
      const result = registerSchema.safeParse({
        name: 'Attacker',
        email: 'attacker@example.com',
        password: 'password1234',
        isAdmin: true,
      });
      expect(result.success).toBe(false);
    });

    it('loginSchema rejects unknown fields', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        csrfToken: 'injected',
      });
      expect(result.success).toBe(false);
    });

    it('createBookingSchema rejects injected role, userId, status, slotEnd', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '18:00',
        role: 'admin',
        userId: 'injected-user',
        status: 'confirmed',
        slotEnd: '19:00',
      });
      expect(result.success).toBe(false);
    });

    it('createTurfSchema rejects unknown fields', () => {
      const result = createTurfSchema.safeParse({
        name: 'Turf',
        city: 'Mumbai',
        address: '123 Address',
        sports: ['football'],
        pricePerSlotPaise: 100000,
        openTime: '06:00',
        closeTime: '22:00',
        rating: 5,
      });
      expect(result.success).toBe(false);
    });

    it('updateTurfSchema rejects unknown fields', () => {
      const result = updateTurfSchema.safeParse({
        city: 'Delhi',
        unknownProp: 'malicious',
      });
      expect(result.success).toBe(false);
    });

    it('availabilityQuerySchema rejects unknown fields', () => {
      const result = availabilityQuerySchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        extraParam: 'unexpected',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('role validation on register', () => {
    it('rejects role "admin"', () => {
      const result = registerSchema.safeParse({
        name: 'Admin Aspirant',
        email: 'admin@example.com',
        password: 'password1234',
        role: 'admin',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('NoSQL operator object injection in email', () => {
    it('rejects email provided as object { "$gt": "" } on register', () => {
      const result = registerSchema.safeParse({
        name: 'NoSQL Injector',
        email: { $gt: '' },
        password: 'password1234',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email provided as object { "$gt": "" } on login', () => {
      const result = loginSchema.safeParse({
        email: { $gt: '' },
        password: 'password1234',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('pricePerSlotPaise bounds and integer check', () => {
    const baseTurf = {
      name: 'Test Turf',
      city: 'Mumbai',
      address: '123 Test Road',
      sports: ['football' as const],
      openTime: '06:00',
      closeTime: '22:00',
    };

    it('rejects float price (1500.50)', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        pricePerSlotPaise: 1500.5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero price', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        pricePerSlotPaise: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative price', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        pricePerSlotPaise: -500,
      });
      expect(result.success).toBe(false);
    });

    it('rejects price below 100 paise', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        pricePerSlotPaise: 99,
      });
      expect(result.success).toBe(false);
    });

    it('rejects price above 1000000 paise', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        pricePerSlotPaise: 1000001,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('openTime and closeTime constraint', () => {
    const baseTurf = {
      name: 'Time Turf',
      city: 'Mumbai',
      address: '123 Test Road',
      sports: ['football' as const],
      pricePerSlotPaise: 100000,
    };

    it('rejects openTime equal to closeTime', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        openTime: '06:00',
        closeTime: '06:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects openTime after closeTime', () => {
      const result = createTurfSchema.safeParse({
        ...baseTurf,
        openTime: '22:00',
        closeTime: '06:00',
      });
      expect(result.success).toBe(false);
    });

    it('updateTurfSchema rejects openTime after closeTime when both provided', () => {
      const result = updateTurfSchema.safeParse({
        openTime: '23:00',
        closeTime: '07:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('real calendar date validation (YYYY-MM-DD)', () => {
    it('rejects non-existent date 2026-02-30', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-02-30',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid month date 2026-13-01', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-13-01',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects 2026-04-31 (April has 30 days)', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-04-31',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-leap year 2025-02-29', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2025-02-29',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('accepts leap year 2024-02-29', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2024-02-29',
        slotStart: '18:00',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('slotStart on the hour requirement', () => {
    it('accepts slotStart on the hour: 18:00', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(true);
    });

    it('rejects slotStart off the hour: 18:30', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '18:30',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid hour 24:00', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '24:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('turfId 24-character hex validation', () => {
    it('accepts valid 24 hex characters', () => {
      const result = createBookingSchema.safeParse({
        turfId: validTurfId,
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-hex string', () => {
      const result = createBookingSchema.safeParse({
        turfId: 'not-a-valid-hex-turfid!!',
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects 23 characters (too short)', () => {
      const result = createBookingSchema.safeParse({
        turfId: '507f1f77bcf86cd79943901',
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });

    it('rejects 25 characters (too long)', () => {
      const result = createBookingSchema.safeParse({
        turfId: '507f1f77bcf86cd799439011a',
        date: '2026-06-15',
        slotStart: '18:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('password length bounds (10-128 chars)', () => {
    it('rejects password of 9 characters (too short)', () => {
      const result = registerSchema.safeParse({
        name: 'Short Pass',
        email: 'short@example.com',
        password: 'a'.repeat(9),
      });
      expect(result.success).toBe(false);
    });

    it('accepts password of 10 characters (boundary min)', () => {
      const result = registerSchema.safeParse({
        name: 'Min Pass',
        email: 'min@example.com',
        password: 'a'.repeat(10),
      });
      expect(result.success).toBe(true);
    });

    it('accepts password of 128 characters (boundary max)', () => {
      const result = registerSchema.safeParse({
        name: 'Max Pass',
        email: 'max@example.com',
        password: 'a'.repeat(128),
      });
      expect(result.success).toBe(true);
    });

    it('rejects password of 129 characters (too long)', () => {
      const result = registerSchema.safeParse({
        name: 'Long Pass',
        email: 'long@example.com',
        password: 'a'.repeat(129),
      });
      expect(result.success).toBe(false);
    });
  });
});
