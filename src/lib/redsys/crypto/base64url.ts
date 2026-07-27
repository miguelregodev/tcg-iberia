/**
 * Utility helpers for Redsys Base64 encoding.
 *
 * Redsys exchanges Merchant Parameters and signatures using Base64.
 * This class centralises every encoding/decoding operation used by
 * the SDK.
 */
export class Base64Url {
  /**
   * Encodes a UTF-8 string into Base64.
   */
  static encode(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  /**
   * Encodes a Buffer into Base64.
   */
  static encodeBuffer(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Decodes a Base64 string into UTF-8.
   */
  static decode(value: string): string {
    return Buffer.from(value, 'base64').toString('utf8');
  }

  /**
   * Decodes a Base64 string into a Buffer.
   */
  static decodeBuffer(value: string): Buffer {
    return Buffer.from(value, 'base64');
  }

  /**
   * Redsys sometimes requires removing CR/LF from generated Base64
   * strings. Node does not insert them, but we normalise anyway so
   * behaviour is deterministic across runtimes.
   */
  static normalize(value: string): string {
    return value.replace(/[\r\n]/g, '');
  }

  /**
   * Encodes JSON as Redsys Merchant Parameters.
   */
  static encodeJson(object: unknown): string {
    return this.normalize(
      this.encode(JSON.stringify(object))
    );
  }

  /**
   * Decodes Merchant Parameters received from Redsys.
   */
  static decodeJson<T>(value: string): T {
    return JSON.parse(this.decode(value)) as T;
  }
}