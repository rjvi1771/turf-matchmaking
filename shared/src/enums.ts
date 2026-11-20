import { z } from 'zod';

export const ROLES = ['player', 'owner'] as const;
export const RoleEnum = z.enum(ROLES);
export type Role = z.infer<typeof RoleEnum>;

export const BOOKING_STATUSES = ['confirmed', 'cancelled'] as const;
export const BookingStatusEnum = z.enum(BOOKING_STATUSES);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const SPORTS = [
  'football',
  'cricket',
  'badminton',
  'tennis',
  'pickleball',
  'basketball',
] as const;
export const SportEnum = z.enum(SPORTS);
export type Sport = z.infer<typeof SportEnum>;
