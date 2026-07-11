/**
 * Shared validators for B2B API endpoints and forms.
 *
 * Centralised here so the request-creation endpoint, the admin approval flow,
 * and the client-side forms all enforce the same contracts.
 */

import type { B2bActivity } from '@prisma/client';

// ── Email ───────────────────────────────────────────────────────────────────
// Same regex used elsewhere in the project (see src/app/api/user/register/route.ts).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// ── Password ────────────────────────────────────────────────────────────────
// Minimum 8 characters, at least one letter and one number. Matches the
// spec in the user story and reuses the customer registration rule.
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isValidPassword(password: string): boolean {
  return PASSWORD_REGEX.test(password);
}

export const PASSWORD_RULES_TEXT =
  'La contraseña debe tener mínimo 8 caracteres e incluir al menos una letra y un número.';

// ── Activity enum ───────────────────────────────────────────────────────────
const VALID_ACTIVITIES = new Set<B2bActivity>([
  'ONLINE_STORE',
  'VENDING_MACHINE',
  'PHYSICAL_STORE',
  'DISTRIBUTOR',
  'OTHER',
]);

export function isValidActivity(value: unknown): value is B2bActivity {
  return typeof value === 'string' && VALID_ACTIVITIES.has(value as B2bActivity);
}

// ── VAT / CIF normalization ─────────────────────────────────────────────────
/**
 * Normalise a VAT number for storage and duplicate detection: uppercase,
 * strip spaces and non-alphanumeric characters. Does not attempt full VIES
 * validation — the admin verifies the number manually against Modelo 036.
 */
export function normalizeVat(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Truncation helpers to protect DB varchar constraints ────────────────────
export function truncate(input: string | null | undefined, max: number): string | null {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}
