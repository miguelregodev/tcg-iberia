/**
 * Redsys HMAC SHA-256 V1 Signature Generation and Verification
 *
 * Implements the official Redsys "Guia de comercios" signature process:
 * 1. Base64 decode the merchant secret key (must be exactly 24 bytes / 192-bit 3DES key)
 * 2. Zero-pad the order number (Ds_Merchant_Order) to a multiple of 8 bytes
 * 3. Encrypt the padded order number with 3DES-CBC (key = merchant secret, IV = 8 zero bytes)
 *    to derive an operation-specific key
 * 4. Calculate HMAC-SHA256 over the Base64-encoded merchant parameters using the derived key
 * 5. Base64 encode the HMAC result -> Ds_Signature
 *
 * Redsys uses a URL-safe Base64 variant (- and _ instead of +, /) WITH padding ('=')
 * for both Ds_MerchantParameters and Ds_Signature - confirmed against real sandbox
 * notification payloads (standard Base64 does not verify).
 *
 * Requires Node's OpenSSL legacy provider (see node-with-legacy-provider.js) because
 * OpenSSL 3.x disables DES/3DES by default.
 */

import 'server-only';

import crypto from 'crypto';
import { getRedsysConfig } from './config';

const DES_BLOCK_SIZE = 8;
const DES_KEY_LENGTH = 24;

/**
 * Convert string/Buffer to Redsys's URL-safe Base64 (- and _ instead of +, /, with padding)
 */
export function toBase64(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decode Redsys's URL-safe Base64 (- and _ instead of +, /, with padding) to Buffer
 */
export function fromBase64(data: string): Buffer {
  const standard = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(standard, 'base64');
}

/**
 * Zero-pad a buffer to a multiple of the given block size (default 8 for 3DES)
 */
function zeroPadToBlockSize(data: Buffer, blockSize: number = DES_BLOCK_SIZE): Buffer {
  const remainder = data.length % blockSize;
  if (remainder === 0) return data;
  return Buffer.concat([data, Buffer.alloc(blockSize - remainder, 0)]);
}

/**
 * Derive operation-specific key using 3DES-CBC (Redsys HMAC_SHA256_V1 spec)
 *
 * @param merchantSecret - Merchant secret key (Base64 encoded, must decode to 24 bytes)
 * @param orderNumber - Order number for this transaction (e.g., "000000000009")
 * @returns Derived key (raw bytes) used as the HMAC-SHA256 key
 */
export function deriveKey3Des(merchantSecret: string, orderNumber: string): Buffer {
  const key = fromBase64(merchantSecret);

  if (key.length !== DES_KEY_LENGTH) {
    throw new Error(
      `Invalid Redsys secret key: expected ${DES_KEY_LENGTH} bytes when Base64-decoded, got ${key.length}. ` +
        'Verify REDSYS_SECRET_KEY matches the raw "Clave de cifrado" value from the Redsys admin module exactly, with no extra encoding.'
    );
  }

  const iv = Buffer.alloc(8, 0);
  const plaintext = zeroPadToBlockSize(Buffer.from(orderNumber, 'utf-8'));

  const cipher = crypto.createCipheriv('des-ede3-cbc', key, iv);
  cipher.setAutoPadding(false);

  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

/**
 * Generate Redsys signature using HMAC SHA-256 V1
 *
 * @param merchantParametersBase64 - Base64-encoded merchant parameters JSON
 * @param orderNumber - Order number (exactly as sent in merchant parameters)
 * @returns Base64-encoded signature
 */
export function generateSignature(
  merchantParametersBase64: string,
  orderNumber: string
): string {
  const config = getRedsysConfig();

  const derivedKey = deriveKey3Des(config.secretKey, orderNumber);

  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update(merchantParametersBase64);
  const signature = toBase64(hmac.digest());

  if (process.env.NODE_ENV !== 'production') {
    console.log('[REDSYS DEBUG] Derived key (3DES) length:', derivedKey.length);
    console.log('[REDSYS DEBUG] Order number used for derivation:', orderNumber);
    console.log('[REDSYS DEBUG] Merchant params base64 length:', merchantParametersBase64.length);
    console.log('[REDSYS DEBUG] HMAC-SHA256 digest length (bytes):', 32);
  }

  return signature;
}

/**
 * Verify Redsys signature
 *
 * @param merchantParametersBase64 - Base64-encoded merchant parameters
 * @param signatureBase64 - Base64-encoded signature to verify
 * @param orderNumber - Order number used for signing
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(
  merchantParametersBase64: string,
  signatureBase64: string,
  orderNumber: string
): boolean {
  try {
    // Calculate expected signature
    const expectedSignature = generateSignature(merchantParametersBase64, orderNumber);

    // Use constant-time comparison to prevent timing attacks
    return constantTimeCompare(signatureBase64, expectedSignature);
  } catch (error) {
    console.error('[REDSYS] Signature verification error:', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
