import { createHmac } from 'crypto';

import { REDSYS, RedsysSignatureVersion } from '../constants';
import { RedsysCryptoError } from '../errors';
import { Base64Url } from './base64url';
import { timingSafeEqual } from 'crypto';

/**
 * Generates Redsys HMAC signatures.
 *
 * The input key MUST be the output produced by TripleDes.encrypt().
 *
 * This class supports both Redsys algorithms:
 *
 *  - HMAC_SHA256_V1
 *  - HMAC_SHA512_V2
 */
export class Hmac {

  /**
   * Generates the Redsys signature.
   *
   * @param data Base64 MerchantParameters
   * @param key Output from TripleDes.encrypt()
   * @param version Redsys signature version
   */
  static sign(
    data: string,
    key: Buffer,
    version: RedsysSignatureVersion,
  ): string {

    const algorithm = this.resolveAlgorithm(version);

    try {

      const digest = createHmac(algorithm, key)
        .update(data, 'utf8')
        .digest();

      return Base64Url.normalize(
        Base64Url.encodeBuffer(digest),
      );

    } catch (error) {

      throw new RedsysCryptoError(
        error instanceof Error
          ? error.message
          : 'Unable to generate Redsys HMAC.',
      );

    }
  }

  /**
   * Verifies an incoming Redsys signature.
   */
  static verify(
    expectedSignature: string,
    calculatedSignature: string,
  ): boolean {

    const a = Buffer.from(expectedSignature);

    const b = Buffer.from(calculatedSignature);

    if (a.length !== b.length) {
        return false;
    }

    return timingSafeEqual(a, b);

  }

  /**
   * Maps Redsys signature versions to Node crypto algorithms.
   */
  private static resolveAlgorithm(
    version: RedsysSignatureVersion,
  ): 'sha256' | 'sha512' {

    switch (version) {

      case REDSYS.SIGNATURE_VERSION.SHA256:
        return 'sha256';

      case REDSYS.SIGNATURE_VERSION.SHA512:
        return 'sha512';

      default:
        throw new RedsysCryptoError(
          `Unsupported Redsys signature version: ${version}`,
        );

    }

  }

}