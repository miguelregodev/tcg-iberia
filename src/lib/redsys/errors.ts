/**
 * Base class for every Redsys-specific error.
 */
export abstract class RedsysError extends Error {
  readonly code: string;

  protected constructor(code: string, message: string) {
    super(message);

    this.name = new.target.name;
    this.code = code;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Missing or invalid Redsys configuration.
 */
export class RedsysConfigurationError extends RedsysError {
  constructor(message: string) {
    super('CONFIGURATION_ERROR', message);
  }
}

/**
 * Merchant parameters could not be encoded or decoded.
 */
export class RedsysMerchantParametersError extends RedsysError {
  constructor(message: string) {
    super('MERCHANT_PARAMETERS_ERROR', message);
  }
}

/**
 * Signature generation failed.
 */
export class RedsysSignatureError extends RedsysError {
  constructor(message: string) {
    super('SIGNATURE_ERROR', message);
  }
}

/**
 * Incoming notification signature is invalid.
 */
export class RedsysInvalidSignatureError extends RedsysError {
  constructor() {
    super(
      'INVALID_SIGNATURE',
      'The Redsys notification signature is not valid.',
    );
  }
}

/**
 * Redsys notification payload is malformed.
 */
export class RedsysNotificationError extends RedsysError {
  constructor(message: string) {
    super('NOTIFICATION_ERROR', message);
  }
}

/**
 * Unsupported Redsys protocol version.
 */
export class RedsysProtocolError extends RedsysError {
  constructor(version: string) {
    super(
      'PROTOCOL_ERROR',
      `Unsupported Redsys protocol version: ${version}`,
    );
  }
}

/**
 * Unsupported transaction type.
 */
export class RedsysTransactionError extends RedsysError {
  constructor(transactionType: string) {
    super(
      'TRANSACTION_ERROR',
      `Unsupported Redsys transaction type: ${transactionType}`,
    );
  }
}

/**
 * Cryptographic operation failed.
 */
export class RedsysCryptoError extends RedsysError {
  constructor(message: string) {
    super('CRYPTO_ERROR', message);
  }
}