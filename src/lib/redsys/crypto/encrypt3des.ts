import { createCipheriv } from 'crypto';

import { RedsysCryptoError } from '../errors';
import { Base64Url } from './base64url';

/**
 * Implements the TripleDES operation defined by Redsys.
 *
 * The resulting encrypted order is later used as the HMAC key.
 *
 * Algorithm:
 *
 * 1. Decode merchant secret key from Base64.
 * 2. Encrypt Ds_Order using 3DES CBC.
 * 3. IV = 8 zero bytes.
 * 4. PKCS#7 padding.
 */
export class TripleDes {
  /**
   * Encrypts a Redsys order using the merchant secret key.
   *
   * @param order Order number (Ds_Order)
   * @param secretKey Merchant secret key (Base64)
   */
  static encrypt(order: string, secretKey: string): Buffer {
    try {
      const key = Base64Url.decodeBuffer(secretKey);

      if (key.length !== 24) {
        throw new RedsysCryptoError(
          `Invalid 3DES key length (${key.length} bytes). Expected 24 bytes.`,
        );
      }

      const iv = Buffer.alloc(8, 0);

      const cipher = createCipheriv(
        'des-ede3-cbc',
        key,
        iv,
      );

      cipher.setAutoPadding(true);

      const encrypted = Buffer.concat([
        cipher.update(order, 'utf8'),
        cipher.final(),
      ]);

      return encrypted;
    } catch (error) {
      if (error instanceof RedsysCryptoError) {
        throw error;
      }

      throw new RedsysCryptoError(
        error instanceof Error
          ? error.message
          : 'Unable to encrypt order using TripleDES.',
      );
    }
  }
}