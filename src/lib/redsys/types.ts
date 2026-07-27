import type { RedsysSignatureVersion, RedsysTransactionType } from './constants';

/**
 * Merchant parameters sent to Redsys.
 *
 * Property names intentionally match Redsys documentation.
 */
export interface RedsysMerchantParameters {
  Ds_Merchant_Amount: string;
  Ds_Merchant_Order: string;
  Ds_Merchant_MerchantCode: string;
  Ds_Merchant_Currency: string;
  Ds_Merchant_TransactionType: RedsysTransactionType;
  Ds_Merchant_Terminal: string;
  Ds_Merchant_MerchantURL: string;
  Ds_Merchant_UrlOK: string;
  Ds_Merchant_UrlKO: string;

  Ds_Merchant_ProductDescription?: string;
  Ds_Merchant_Titular?: string;
  Ds_Merchant_MerchantName?: string;
  Ds_Merchant_ConsumerLanguage?: string;
  Ds_Merchant_MerchantData?: string;
}

/**
 * Payload posted to Redsys gateway.
 */
export interface RedsysPaymentRequest {

  signatureVersion: RedsysSignatureVersion;

  merchantParameters: string;

  signature: string;

  gatewayUrl: string;
}

/**
 * Parameters returned by Redsys after payment.
 *
 * Redsys returns many optional fields depending on
 * transaction type.
 */
export interface RedsysNotification {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}

/**
 * Raw HTTP POST received from Redsys.
 */
export interface RedsysNotificationRequest {

  Ds_SignatureVersion: string;

  Ds_MerchantParameters: string;

  Ds_Signature: string;
}

/**
 * Result after signature verification.
 */
export interface RedsysVerificationResult {

  valid: boolean;

  notification: RedsysNotification;
}

/**
 * Result returned by RedsysClient.createPayment().
 */
export interface RedsysPaymentSession {

  gatewayUrl: string;

  signatureVersion: RedsysSignatureVersion;

  merchantParameters: string;

  signature: string;
}

/**
 * Decoded Ds_MerchantParameters received from Redsys
 * after payment authorization.
 */
export interface RedsysMerchantResponse {
  Ds_Date: string;
  Ds_Hour: string;

  Ds_Amount: string;

  Ds_Currency: string;

  Ds_Order: string;

  Ds_MerchantCode: string;

  Ds_Terminal: string;

  Ds_Response: string;

  Ds_TransactionType: string;

  Ds_SecurePayment?: string;

  Ds_AuthorisationCode?: string;

  Ds_Card_Country?: string;

  Ds_Card_Brand?: string;

  Ds_ConsumerLanguage?: string;

  Ds_MerchantData?: string;

  Ds_ProcessedPayMethod?: string;

  Ds_Control_XXXX?: string;

  Ds_Card_Type?: string;
}