/**
 * Redsys type definitions
 *
 * Defines interfaces and types for Redsys payment processing
 * Uses official Redsys casing: DS_MERCHANT_* (uppercase) per official documentation
 */

/**
 * Redsys merchant parameters (request)
 * These are the parameters sent to Redsys for payment authorization
 * Field names use official Redsys uppercase format from documentation
 */
export interface RedsysMerchantParameters {
  DS_MERCHANT_AMOUNT: string; // Amount in cents (e.g., "10050" for €100.50)
  DS_MERCHANT_CURRENCY: string; // Currency code (e.g., "978" for EUR)
  DS_MERCHANT_ORDER: string; // Order number (1-12 numeric digits)
  DS_MERCHANT_MERCHANTCODE: string; // Merchant code provided by Redsys
  DS_MERCHANT_TERMINAL: string; // Terminal number
  DS_MERCHANT_TRANSACTIONTYPE: string; // Transaction type (e.g., "0" for authorization)
  DS_MERCHANT_MERCHANTURL?: string; // Merchant notification URL (server-to-server)
  DS_MERCHANT_URLOK?: string; // Success URL (customer browser redirect)
  DS_MERCHANT_URLKO?: string; // Error URL (customer browser redirect)
  DS_MERCHANT_MERCHANTNAME?: string; // Store/merchant name
  DS_MERCHANT_CONSUMERLANGUAGE?: string; // Language code (e.g., "1" for Spanish)
  DS_MERCHANT_PRODUCTDESCRIPTION?: string; // Product description
}

/**
 * Redsys notification payload (response from Redsys server-to-server)
 * This is sent by Redsys to the merchant's notification URL
 */
export interface RedsysNotificationPayload {
  Ds_SignatureVersion?: string; // Signature version (e.g., "HMAC_SHA256_V1" or "HMAC_SHA512_V1")
  Ds_MerchantParameters: string; // Base64URL-encoded merchant response parameters
  Ds_Signature: string; // Base64URL-encoded signature
}

/**
 * Decoded Redsys merchant response parameters
 * These are the actual values returned by Redsys after payment attempt
 */
export interface RedsysResponseParameters {
  Ds_Amount?: string; // Amount charged in cents
  Ds_AuthorisationCode?: string; // Authorization code from bank
  Ds_Card_Country?: string; // Country code of card
  Ds_Card_Brand?: string; // Card brand (e.g., "1" for VISA)
  Ds_Card_Type?: string; // Card type
  Ds_CardNumber?: string; // Masked card number (if provided)
  Ds_ConsumerLanguage?: string; // Consumer language
  Ds_Currency?: string; // Currency code (e.g., "978" for EUR)
  Ds_MerchantCode?: string; // Merchant code
  Ds_MerchantData?: string; // Custom merchant data (if provided)
  Ds_Order?: string; // Order number (matches request)
  Ds_Response?: string; // Response code from bank
  Ds_SecurePayment?: string; // Secure payment flag (e.g., "1" for 3D Secure)
  Ds_Terminal?: string; // Terminal number
  Ds_Transaction_Type?: string; // Transaction type
  Ds_TransactionType?: string; // Transaction type (alternative field name)
  Ds_Timestamp?: string; // Timestamp of transaction
  Ds_Reference?: string; // Unique transaction reference (transaction ID)
}

/**
 * Redsys response codes
 * Reference: https://pagosonline.redsys.es/desarrolladores-inicio/documentacion-operativa/codigos-de-respuesta/
 */
export const REDSYS_RESPONSE_CODES = {
  // Success codes (0000-0099)
  SUCCESS: '0000', // Authorised transaction
  TEST_MODE_SUCCESS: '0100', // Authorised for test mode
  
  // User action required
  SECURE_PAYMENT_REQUIRED: '0101', // Secure payment required (3D Secure)
  
  // Declined/Error codes (1000+)
  DECLINED: '0005', // Authorisation failed
  INVALID_MERCHANT: '0006', // Invalid merchant code
  INVALID_TRANSACTION: '0008', // Transaction type not valid
  INVALID_AMOUNT: '0011', // Incorrect amount
  INVALID_CURRENCY: '0013', // Invalid currency
  INVALID_CARD: '0014', // Invalid card number
  INVALID_ORDER: '0030', // Transaction authorisation code not numeric
  ORDER_ALREADY_EXISTS: '0040', // Order number not numeric or already exists
  CANCELLED: '0190', // Cancelled transaction
  SYSTEM_ERROR: '0666', // System error (temporary)
} as const;

/**
 * Check if a Redsys response code indicates success
 * Codes 0000-0099 are considered successful
 */
export function isRedsysResponseSuccess(responseCode: string): boolean {
  const code = parseInt(responseCode, 10);
  return code >= 0 && code <= 99;
}

/**
 * Check if a Redsys response code indicates the transaction was cancelled
 */
export function isRedsysResponseCancelled(responseCode: string): boolean {
  return responseCode === REDSYS_RESPONSE_CODES.CANCELLED;
}

/**
 * Get human-readable description of Redsys response code
 */
export function getRedsysResponseDescription(responseCode: string): string {
  // Check if it's a known code with a description
  for (const [key, value] of Object.entries(REDSYS_RESPONSE_CODES)) {
    if (value === responseCode) {
      return key; // Return the constant name
    }
  }

  // Try to categorize by range
  const code = parseInt(responseCode, 10);
  if (code >= 0 && code <= 99) {
    return 'AUTHORISED';
  } else if (code >= 100 && code <= 199) {
    return 'PENDING_VERIFICATION';
  } else {
    return 'DECLINED_OR_ERROR';
  }
}
