import { INDIAN_STATES, type IndianState } from '../models/Address';

// ─── Phone Number Helpers ────────────────────────────────────────────────────

const PHONE_REGEX = /^\d{10}$/;

/**
 * Validates a phone number string against the 10-digit Indian format.
 * Returns `true` if the phone is valid, `false` otherwise.
 */
export const isValidPhone = (phone: string): boolean =>
  PHONE_REGEX.test(phone.trim());

/**
 * Validates and formats an Indian phone number.
 * Strips all non-digit characters, validates the result is exactly 10 digits,
 * and returns the formatted number. Throws on invalid input.
 *
 * @param phone - Raw phone number string
 * @returns Formatted 10-digit phone number string
 * @throws Error if the cleaned phone number is not 10 digits
 */
export const formatPhoneNumber = (phone: string): string => {
  // Strip all non-digit characters (spaces, dashes, country code prefix, etc.)
  const cleaned = phone.replace(/\D/g, '');

  // Handle numbers with +91 or 91 prefix
  const normalized =
    cleaned.length === 12 && cleaned.startsWith('91')
      ? cleaned.slice(2)
      : cleaned;

  if (!PHONE_REGEX.test(normalized)) {
    throw new Error(
      `Invalid phone number: "${phone}". Expected 10 digits after cleaning, got ${normalized.length}.`
    );
  }

  return normalized;
};

// ─── Zip Code Helpers ────────────────────────────────────────────────────────

const ZIP_REGEX = /^\d{6}$/;

/**
 * Validates an Indian zip code (PIN code).
 * Must be exactly 6 digits. Leading zeros are significant.
 *
 * @param zipCode - Zip code string to validate
 * @returns `true` if the zip code is valid
 */
export const validateZipCode = (zipCode: string): boolean =>
  ZIP_REGEX.test(zipCode.trim());

/**
 * Validates and returns a cleaned zip code.
 * Throws on invalid input.
 *
 * @param zipCode - Raw zip code string
 * @returns Cleaned 6-digit zip code string
 * @throws Error if the zip code is not 6 digits
 */
export const formatZipCode = (zipCode: string): string => {
  const cleaned = zipCode.trim();
  if (!ZIP_REGEX.test(cleaned)) {
    throw new Error(
      `Invalid zip code: "${zipCode}". Expected exactly 6 digits.`
    );
  }
  return cleaned;
};

// ─── State Helpers ───────────────────────────────────────────────────────────

/** Set of valid Indian state names for O(1) lookup */
const VALID_STATES_SET: ReadonlySet<string> = new Set(
  INDIAN_STATES.map((s) => s.toLowerCase())
);

/**
 * Validates whether a given string is a recognized Indian state or UT.
 * Comparison is case-insensitive.
 *
 * @param state - State name to validate
 * @returns `true` if the state is a valid Indian state/UT
 */
export const validateIndianState = (state: string): boolean =>
  VALID_STATES_SET.has(state.trim().toLowerCase());

/**
 * Finds and returns the canonical (properly cased) Indian state name.
 * Returns `null` if no match is found.
 *
 * @param state - State name to look up (case-insensitive)
 * @returns The canonical state name, or `null`
 */
export const resolveIndianState = (state: string): IndianState | null => {
  const normalized = state.trim().toLowerCase();
  return (
    INDIAN_STATES.find((s) => s.toLowerCase() === normalized) ?? null
  );
};
