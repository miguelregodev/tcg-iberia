/**
 * Postal code utility functions for shipping zones.
 * This module is safe to import on the client side.
 */

/**
 * Validates that a Spanish postal code is correctly formatted (5 digits, all numeric).
 *
 * @param postalCode The postal code string to validate.
 * @returns true if the postal code is valid (5 numeric digits), false otherwise.
 */
export function isValidSpanishPostalCode(postalCode: string): boolean {
  if (!postalCode) return false;
  const normalized = postalCode.trim();
  // Must be exactly 5 digits
  return /^\d{5}$/.test(normalized);
}

/**
 * Detects whether a Spanish postal code belongs to the Canary Islands.
 *
 * Postal codes starting with 35 (Gran Canaria, Fuerteventura, Lanzarote)
 * or 38 (Tenerife, La Palma, La Gomera, El Hierro) are Canary.
 *
 * @param postalCode The postal code string (may contain spaces or formatting).
 * @returns true if the postal code is in the Canary Islands.
 */
export function isCanaryIslandsPostalCode(postalCode: string): boolean {
  if (!postalCode) return false;
  const normalized = postalCode.trim().replace(/\s+/g, '');
  return normalized.startsWith('35') || normalized.startsWith('38');
}
