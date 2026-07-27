import { timingSafeEqual } from 'crypto';

import { redsysConfig } from './config';
import { MerchantParameters } from './merchant-parameters';
import { TripleDes } from './crypto/encrypt3des';
import { Hmac } from './crypto/hmac';
import { RedsysInvalidSignatureError } from './errors';

export class RedsysSignatureService {

  /**
   * Generates the Redsys signature for an outgoing payment.
   *
   * @param merchantParameters Base64 encoded Merchant Parameters
   * @param order Redsys order number (Ds_Order)
   */
  generate(
    merchantParameters: string,
    order: string,
  ): string {

    const encryptedOrder = TripleDes.encrypt(
      order,
      redsysConfig.secretKey,
    );

    return Hmac.sign(
      merchantParameters,
      encryptedOrder,
      redsysConfig.signatureVersion,
    );

  }

  /**
   * Verifies an incoming Redsys notification.
   *
   * Throws RedsysInvalidSignatureError if the signature is not valid.
   */
  verify(
    merchantParameters: string,
    receivedSignature: string,
  ): void {

    const decoded =
      MerchantParameters.decode<{
        Ds_Order: string;
      }>(merchantParameters);

    const calculatedSignature =
      this.generate(
        merchantParameters,
        decoded.Ds_Order,
      );

    const expected = Buffer.from(receivedSignature);

    const calculated = Buffer.from(calculatedSignature);

    if (
      expected.length !== calculated.length ||
      !timingSafeEqual(expected, calculated)
    ) {
      throw new RedsysInvalidSignatureError();
    }

  }

}