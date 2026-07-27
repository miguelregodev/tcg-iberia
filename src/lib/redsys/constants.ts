/**
 * Centralised Redsys constants.
 *
 * This file intentionally contains no business logic.
 * It only exposes protocol constants defined by Redsys.
 */

export const REDSYS = {
  /**
   * Currency codes (ISO-4217)
   */
  CURRENCY: {
    EUR: '978',
  },

  /**
   * Transaction types.
   *
   * 0 = Authorization / Purchase
   * 1 = Preauthorization
   * 3 = Refund
   */
  TRANSACTION_TYPE: {
    PAYMENT: '0',
    PREAUTHORIZATION: '1',
    REFUND: '3',
  },

  /**
   * Supported signature versions.
   */
  SIGNATURE_VERSION: {
    SHA256: 'HMAC_SHA256_V1',
    SHA512: 'HMAC_SHA512_V2',
  },

  /**
   * Redsys response codes.
   *
   * 0000-0099 = Approved
   */
  RESPONSE: {
    MAX_APPROVED_CODE: 99,
  },

  /**
   * HTTP form fields expected by Redsys.
   */
  FORM_FIELDS: {
    SIGNATURE_VERSION: 'Ds_SignatureVersion',
    MERCHANT_PARAMETERS: 'Ds_MerchantParameters',
    SIGNATURE: 'Ds_Signature',
  },

  DEFAULT_CONSUMER_LANGUAGE: '001'
} as const;

export type RedsysSignatureVersion =
  typeof REDSYS.SIGNATURE_VERSION[keyof typeof REDSYS.SIGNATURE_VERSION];

export type RedsysTransactionType =
  typeof REDSYS.TRANSACTION_TYPE[keyof typeof REDSYS.TRANSACTION_TYPE];