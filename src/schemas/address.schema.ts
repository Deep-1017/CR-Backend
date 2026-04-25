import { z } from "zod";
import { INDIAN_STATES, SUPPORTED_COUNTRIES } from "../models/Address";

export const createAddressSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(50, "Label cannot exceed 50 characters"),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name cannot exceed 100 characters"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  addressLine1: z
    .string()
    .min(1, "Address line 1 is required")
    .max(200, "Address line 1 cannot exceed 200 characters"),
  addressLine2: z
    .string()
    .max(200, "Address line 2 cannot exceed 200 characters")
    .optional(),
  city: z.string().min(1, "City is required").max(100, "City cannot exceed 100 characters"),
  state: z.enum(INDIAN_STATES, { required_error: "State is required" }),
  zipCode: z
    .string()
    .regex(/^\d{6}$/, "Zip code must be exactly 6 digits"),
  country: z.enum(SUPPORTED_COUNTRIES).optional().default("India"),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;

