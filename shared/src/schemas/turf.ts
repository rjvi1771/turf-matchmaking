import { z } from 'zod';
import { SportEnum } from '../enums.js';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const baseTurfSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(50),
    address: z.string().trim().min(5).max(255),
    sports: z.array(SportEnum).min(1),
    pricePerSlotPaise: z.number().int().min(100).max(1_000_000),
    openTime: z.string().regex(timeRegex, 'Time must be in HH:mm format'),
    closeTime: z.string().regex(timeRegex, 'Time must be in HH:mm format'),
    slotMinutes: z.literal(60).default(60),
  })
  .strict();

export const createTurfSchema = baseTurfSchema.refine(
  (data) => data.openTime < data.closeTime,
  {
    message: 'openTime must be before closeTime',
    path: ['closeTime'],
  }
);

export type CreateTurfInput = z.infer<typeof createTurfSchema>;

export const updateTurfSchema = baseTurfSchema
  .partial()
  .strict()
  .refine(
    (data) => {
      if (data.openTime !== undefined && data.closeTime !== undefined) {
        return data.openTime < data.closeTime;
      }
      return true;
    },
    {
      message: 'openTime must be before closeTime',
      path: ['closeTime'],
    }
  );

export type UpdateTurfInput = z.infer<typeof updateTurfSchema>;
