/**
 * Redsys notification parser
 *
 * Decodes and validates Redsys notification payloads
 */

import 'server-only';

import { fromBase64 } from './signature';
import {
  RedsysNotificationPayload,
  RedsysResponseParameters,
} from './types';

/**
 * Parse Redsys notification payload from POST body
 *
 * Expects form-data or URL-encoded with Ds_MerchantParameters and Ds_Signature
 *
 * @param body - Parsed request body (form data)
 * @returns Parsed notification payload
 * @throws Error if required fields are missing
 */
export function parseRedsysNotificationPayload(
  body: Record<string, unknown>
): RedsysNotificationPayload {
  const Ds_MerchantParameters = String(body.Ds_MerchantParameters || '').trim();
  const Ds_Signature = String(body.Ds_Signature || '').trim();
  const Ds_SignatureVersion = String(body.Ds_SignatureVersion || 'HMAC_SHA256_V1').trim();

  if (!Ds_MerchantParameters) {
    throw new Error('Missing Ds_MerchantParameters in Redsys notification');
  }

  if (!Ds_Signature) {
    throw new Error('Missing Ds_Signature in Redsys notification');
  }

  return {
    Ds_SignatureVersion,
    Ds_MerchantParameters,
    Ds_Signature,
  };
}

/**
 * Decode merchant parameters from Base64
 *
 * @param merchantParametersBase64 - Base64-encoded merchant parameters
 * @returns Decoded merchant parameters as JSON object
 * @throws Error if decoding fails
 */
export function decodeRedsysMerchantParameters(
  merchantParametersBase64: string
): RedsysResponseParameters {
  try {
    const decoded = fromBase64(merchantParametersBase64).toString('utf-8');
    const parsed = JSON.parse(decoded) as RedsysResponseParameters;
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to decode Redsys merchant parameters: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract order number from merchant response parameters
 *
 * @param params - Decoded merchant response parameters
 * @returns Order number
 * @throws Error if order number is missing
 */
export function extractRedsysOrderNumber(params: RedsysResponseParameters): string {
  const orderNumber = params.Ds_Order;

  if (!orderNumber) {
    throw new Error('Missing Ds_Order in Redsys merchant parameters');
  }

  return orderNumber;
}

/**
 * Extract response code from merchant response parameters
 *
 * @param params - Decoded merchant response parameters
 * @returns Response code
 * @throws Error if response code is missing
 */
export function extractRedsysResponseCode(params: RedsysResponseParameters): string {
  const responseCode = params.Ds_Response;

  if (!responseCode) {
    throw new Error('Missing Ds_Response in Redsys merchant parameters');
  }

  return responseCode;
}

/**
 * Extract transaction reference from merchant response parameters
 *
 * @param params - Decoded merchant response parameters
 * @returns Transaction reference (Ds_Reference)
 */
export function extractRedsysTransactionReference(params: RedsysResponseParameters): string {
  return params.Ds_Reference || '';
}

/**
 * Extract authorization code from merchant response parameters
 *
 * @param params - Decoded merchant response parameters
 * @returns Authorization code (Ds_AuthorisationCode)
 */
export function extractRedsysAuthCode(params: RedsysResponseParameters): string {
  return params.Ds_AuthorisationCode || '';
}

/**
 * Extract amount from merchant response parameters (in cents)
 *
 * @param params - Decoded merchant response parameters
 * @returns Amount in cents as number
 */
export function extractRedsysAmount(params: RedsysResponseParameters): number {
  const amountStr = params.Ds_Amount || '0';
  return parseInt(amountStr, 10);
}

/**
 * Extract currency from merchant response parameters
 *
 * @param params - Decoded merchant response parameters
 * @returns Currency code (e.g., "978" for EUR)
 */
export function extractRedsysCurrency(params: RedsysResponseParameters): string {
  return params.Ds_Currency || '978'; // Default to EUR
}
