import { Base64Url } from './crypto/base64url';
import { RedsysMerchantParameters } from './types';
import { RedsysMerchantParametersError } from './errors';

/**
 * Builder and serializer for Redsys Merchant Parameters.
 *
 * Responsible for:
 *
 *  - Validating required fields.
 *  - Building the JSON payload.
 *  - Encoding it to Base64.
 *  - Decoding MerchantParameters received from Redsys.
 */
export class MerchantParameters {

    private static sanitize(
    parameters: RedsysMerchantParameters,
    ): RedsysMerchantParameters {

        return Object.fromEntries(
            Object.entries(parameters).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null,
            ),
        ) as RedsysMerchantParameters;

    }

  /**
   * Serializes merchant parameters into the Base64 string expected
   * by Redsys.
   */
  static encode(
    parameters: RedsysMerchantParameters,
  ): string {

    this.validate(parameters);

    return Base64Url.encodeJson(
        this.sanitize(parameters),
    );

  }

  /**
   * Decodes MerchantParameters received from Redsys.
   */
  static decode<T = RedsysMerchantParameters>(
    encoded: string,
  ): T {

    try {

      return Base64Url.decodeJson<T>(encoded);

    } catch (error) {

      throw new RedsysMerchantParametersError(
        error instanceof Error
          ? error.message
          : 'Unable to decode MerchantParameters.',
      );

    }

  }

  /**
   * Validates required Redsys fields.
   */
  private static validate(
    parameters: RedsysMerchantParameters,
  ): void {

    const requiredFields: Array<keyof RedsysMerchantParameters> = [
      'Ds_Merchant_Amount',
      'Ds_Merchant_Order',
      'Ds_Merchant_MerchantCode',
      'Ds_Merchant_Currency',
      'Ds_Merchant_TransactionType',
      'Ds_Merchant_Terminal',
      'Ds_Merchant_MerchantURL',
      'Ds_Merchant_UrlOK',
      'Ds_Merchant_UrlKO',
    ];

    for (const field of requiredFields) {

      const value = parameters[field];

      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        throw new RedsysMerchantParametersError(
          `Missing required merchant parameter: ${field}`,
        );
      }

    }

  }

}