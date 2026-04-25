import { z } from 'zod';
import { INDIAN_STATES, SUPPORTED_COUNTRIES } from '../models/Address';

// ─── Reusable Field Schemas ──────────────────────────────────────────────────

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' });

export const zipCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, { message: 'Zip code must be exactly 6 digits (Indian format)' });

export const indianStateSchema = z.enum(INDIAN_STATES, {
  errorMap: () => ({ message: 'Please select a valid Indian state' }),
});

export const countrySchema = z.enum(SUPPORTED_COUNTRIES, {
  errorMap: () => ({ message: 'Only India is currently supported' }),
});

// ─── Create Address Schema ───────────────────────────────────────────────────

export const createAddressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Address label is required')
    .max(50, 'Label cannot exceed 50 characters'),
  fullName: z
    .string()
    .trim()
    .min(1, 'Full name is required')
    .max(100, 'Full name cannot exceed 100 characters'),
  phone: phoneSchema,
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Address line 1 is required')
    .max(200, 'Address line 1 cannot exceed 200 characters'),
  addressLine2: z
    .string()
    .trim()
    .max(200, 'Address line 2 cannot exceed 200 characters')
    .optional()
    .default(''),
  city: z
    .string()
    .trim()
    .min(1, 'City is required')
    .max(100, 'City cannot exceed 100 characters'),
  state: indianStateSchema,
  zipCode: zipCodeSchema,
  country: countrySchema.default('India'),
  isDefault: z.boolean().optional().default(false),
});

// ─── Update Address Schema ───────────────────────────────────────────────────
// All fields optional, but at least one must be provided

export const updateAddressSchema = createAddressSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update an address',
  });

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
