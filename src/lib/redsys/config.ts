import { REDSYS, RedsysSignatureVersion } from './constants';

export interface RedsysConfig {


  hmacAlgorithm: 'sha256' | 'sha512';
  /**
   * Merchant code (FUC)
   */
  merchantCode: string;

  /**
   * Terminal number.
   */
  terminal: string;

  /**
   * Secret key supplied by Redsys.
   *
   * IMPORTANT:
   * This is NOT base64-decoded here.
   * The signature service will decode it when required.
   */
  secretKey: string;

  /**
   * Signature algorithm.
   */
  signatureVersion: RedsysSignatureVersion;

  /**
   * Redsys gateway URL.
   */
  gatewayUrl: string;

  /**
   * Merchant notification URL.
   */
  merchantUrl: string;

  /**
   * Redirect after successful payment.
   */
  urlOk: string;

  /**
   * Redirect after cancelled/failed payment.
   */
  urlKo: string;

  /**
   * Merchant display name.
   */
  merchantName: string;

  /**
   * Currency ISO-4217 numeric code.
   */
  currency: string;

  /**
   * Default terminal transaction type.
   */
  transactionType: string;

  /**
   * Indicates whether Test environment is being used.
   */
  isTest: boolean;
}

const TEST_GATEWAY =
  'https://sis-t.redsys.es:25443/sis/realizarPago';

const PRODUCTION_GATEWAY =
  'https://sis.redsys.es/sis/realizarPago';

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required Redsys environment variable: ${name}`
    );
  }

  return value.trim();
}

function getSignatureVersion(): RedsysSignatureVersion {
  const version =
    process.env.REDSYS_SIGNATURE_VERSION ??
    REDSYS.SIGNATURE_VERSION.SHA256;

  switch (version) {
    case REDSYS.SIGNATURE_VERSION.SHA256:
    case REDSYS.SIGNATURE_VERSION.SHA512:
      return version;

    default:
      throw new Error(
        `Unsupported Redsys signature version: ${version}`
      );
  }
}

function getGateway(isTest: boolean): string {
  if (process.env.REDSYS_GATEWAY_URL) {
    return process.env.REDSYS_GATEWAY_URL.trim();
  }

  return isTest
    ? TEST_GATEWAY
    : PRODUCTION_GATEWAY;
}

const isTest =
  (process.env.REDSYS_ENVIRONMENT ?? 'test')
    .toLowerCase() !== 'production';

export const redsysConfig: RedsysConfig = Object.freeze({
  merchantCode: required('REDSYS_MERCHANT_CODE'),

  terminal: required('REDSYS_TERMINAL'),

  secretKey: required('REDSYS_SECRET_KEY'),

  signatureVersion: getSignatureVersion(),

  gatewayUrl: getGateway(isTest),

  merchantUrl: required('REDSYS_MERCHANT_URL'),

  urlOk: required('REDSYS_URL_OK'),

  urlKo: required('REDSYS_URL_KO'),

  merchantName:
    process.env.REDSYS_MERCHANT_NAME ??
    'TCG Iberia',

  currency: REDSYS.CURRENCY.EUR,

  transactionType:
    REDSYS.TRANSACTION_TYPE.PAYMENT,

  isTest,
});