/**
 * Redsys payment gateway configuration
 *
 * Loads and validates environment variables for Redsys integration.
 * Supports both test (sandbox) and production environments.
 */

import 'server-only';

export type RedsysEnvironment = 'test' | 'production';

interface RedsysConfig {
  environment: RedsysEnvironment;
  merchantCode: string;
  terminal: string;
  secretKey: string;
  apiUrl: string;
}

let cachedConfig: RedsysConfig | null = null;

/**
 * Load and validate Redsys configuration from environment variables
 * @throws Error if required environment variables are missing or invalid
 */
export function getRedsysConfig(): RedsysConfig {
  if (cachedConfig) return cachedConfig;

  const environment = (process.env.REDSYS_ENVIRONMENT || 'test') as RedsysEnvironment;
  let merchantCode = process.env.REDSYS_MERCHANT_CODE;
  let terminal = process.env.REDSYS_TERMINAL;
  const secretKey = process.env.REDSYS_SECRET_KEY;

  if (!merchantCode) {
    throw new Error('REDSYS_MERCHANT_CODE environment variable is required');
  }

  if (!terminal) {
    throw new Error('REDSYS_TERMINAL environment variable is required');
  }

  if (!secretKey) {
    throw new Error('REDSYS_SECRET_KEY environment variable is required');
  }

  // Ensure merchant code is 9 digits (left-padded with zeros)
  merchantCode = String(merchantCode).padStart(9, '0');
  
  // Terminal can be 1-3 digits, but Redsys requires it as a number without padding
  // Keep it as provided (e.g., "1" not "001")
  terminal = String(terminal).trim();

  // Validate environment value
  if (!['test', 'production'].includes(environment)) {
    throw new Error(
      `Invalid REDSYS_ENVIRONMENT: "${environment}". Must be "test" or "production"`
    );
  }

  // Determine API URL based on environment
  let apiUrl: string;
  if (environment === 'test') {
    apiUrl = process.env.REDSYS_URL_TEST || 'https://sis-t.redsys.es:25443/sis/realizarPago';
  } else {
    apiUrl = process.env.REDSYS_URL_PROD || 'https://sis.redsys.es/sis/realizarPago';
  }

  cachedConfig = {
    environment,
    merchantCode,
    terminal,
    secretKey,
    apiUrl,
  };

  return cachedConfig;
}

/**
 * Get the Redsys API URL based on current environment
 */
export function getRedsysApiUrl(): string {
  return getRedsysConfig().apiUrl;
}

/**
 * Check if we're in test/sandbox mode
 */
export function isRedsysTestMode(): boolean {
  return getRedsysConfig().environment === 'test';
}
