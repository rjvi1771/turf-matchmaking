import { z } from 'zod';

export const turfIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'turfId must be a 24-character hex string');

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (val) => {
      const parts = val.split('-').map(Number);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year === undefined || month === undefined || day === undefined) {
        return false;
      }
      if (month < 1 || month > 12) return false;
      if (day < 1 || day > 31) return false;
      const d = new Date(Date.UTC(year, month - 1, day));
      return (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
      );
    },
    { message: 'Date must be a valid calendar date (YYYY-MM-DD)' }
  );

export const slotStartSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):00$/,
    'slotStart must be in HH:00 format on the hour'
  );

export const createBookingSchema = z
  .object({
    turfId: turfIdSchema,
    date: calendarDateSchema,
    slotStart: slotStartSchema,
  })
  .strict();

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const availabilityQuerySchema = z
  .object({
    turfId: turfIdSchema,
    date: calendarDateSchema,
  })
  .strict();

export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
