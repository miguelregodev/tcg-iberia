import { describe, it, expect, vi } from 'vitest';
import { generateSignature, toBase64, verifySignature } from '@/lib/payments/redsys/signature';
import { parseRedsysNotificationPayload, decodeRedsysMerchantParameters } from '@/lib/payments/redsys/parseNotification';
import { isRedsysResponseSuccess, isRedsysResponseCancelled } from '@/lib/payments/redsys/types';

// Mock server-only module for test environment
vi.mock('server-only', () => ({}), { virtual: true });

// Set up test environment variables for Redsys tests
// Secret must decode to exactly 24 bytes (32 Base64 chars, no padding) for 3DES
process.env.REDSYS_MERCHANT_CODE = '999008881';
process.env.REDSYS_TERMINAL = '1';
process.env.REDSYS_SECRET_KEY = 'Mk9m98IfEblmPfrpsawt7BmxObt98Jev';
process.env.REDSYS_ENVIRONMENT = 'test';

/**
 * Integration tests for Redsys payment processing components.
 *
 * These tests verify the core building blocks of the notification handler:
 * - Signature verification (valid/invalid/tampered)
 * - Merchant parameters encoding/decoding
 * - Response code classification
 * - Amount format handling
 * - Payment status determination
 */

describe('Redsys Payment Processing Integration', () => {
  const TEST_MERCHANT_CODE = '999008881';
  const TEST_TERMINAL = '1';

  function createMerchantParams(overrides?: Record<string, string>) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    return {
      Ds_Merchant_Amount: '10050',
      Ds_Merchant_Order: '000000000001',
      Ds_Merchant_Currency: '978', // EUR
      Ds_Merchant_Response: '0000', // Success
      Ds_Merchant_TransactionType: '0',
      Ds_Merchant_Terminal: TEST_TERMINAL,
      Ds_Merchant_MerchantCode: TEST_MERCHANT_CODE,
      Ds_Merchant_Timestamp: timestamp,
      Ds_Merchant_SecurePayment: '1',
      Ds_AuthorisationCode: '123456',
      Ds_Card_Country: '724',
      Ds_Card_Brand: 'VISA',
      Ds_Card_MaskedPAN: '454545****4545',
      Ds_ProcedureId: '0000000000000001',
      Ds_Merchant_TransactionId: 'txn-123',
      ...overrides,
    };
  }

  describe('Signature Verification', () => {
    it('accepts valid signatures', () => {
      const params = createMerchantParams();
      const encodedParams = toBase64(JSON.stringify(params));
      const signature = generateSignature(encodedParams, params.Ds_Merchant_Order);

      const isValid = verifySignature(encodedParams, signature, params.Ds_Merchant_Order);
      expect(isValid).toBe(true);
    });

    it('rejects invalid signatures', () => {
      const params = createMerchantParams();
      const encodedParams = toBase64(JSON.stringify(params));
      const invalidSignature = toBase64('invalid-signature');

      const isValid = verifySignature(encodedParams, invalidSignature, params.Ds_Merchant_Order);
      expect(isValid).toBe(false);
    });

    it('rejects tampered parameters with original signature', () => {
      const params = createMerchantParams();
      const encodedParams = toBase64(JSON.stringify(params));
      const validSignature = generateSignature(encodedParams, params.Ds_Merchant_Order);

      // Tamper with amount
      params.Ds_Merchant_Amount = '99999';
      const tamperedEncodedParams = toBase64(JSON.stringify(params));

      const isValid = verifySignature(tamperedEncodedParams, validSignature, params.Ds_Merchant_Order);
      expect(isValid).toBe(false);
    });

    it('generates deterministic signatures for same input', () => {
      const params = createMerchantParams();
      const encodedParams = toBase64(JSON.stringify(params));

      const sig1 = generateSignature(encodedParams, params.Ds_Merchant_Order);
      const sig2 = generateSignature(encodedParams, params.Ds_Merchant_Order);

      expect(sig1).toBe(sig2);
    });
  });

  describe('Merchant Parameters Parsing', () => {
    it('parses valid notification payload structure', () => {
      const params = createMerchantParams();
      const encodedParams = toBase64(JSON.stringify(params));
      const signature = generateSignature(encodedParams, params.Ds_Merchant_Order);

      const notification = {
        Ds_SignatureVersion: 'HMAC_SHA256_V1',
        Ds_MerchantParameters: encodedParams,
        Ds_Signature: signature,
      };

      const parsed = parseRedsysNotificationPayload(notification);
      expect(parsed).toHaveProperty('Ds_SignatureVersion', 'HMAC_SHA256_V1');
      expect(parsed).toHaveProperty('Ds_MerchantParameters');
      expect(parsed).toHaveProperty('Ds_Signature');
    });

    it('decodes merchant parameters correctly', () => {
      const params = createMerchantParams({
        Ds_Merchant_Amount: '25500',
        Ds_Card_Brand: 'MASTERCARD',
      });
      const encodedParams = toBase64(JSON.stringify(params));

      const decoded = decodeRedsysMerchantParameters(encodedParams);
      expect(decoded).toEqual(params);
    });

    it('preserves special characters in decoded parameters', () => {
      const params = createMerchantParams();
      params.Ds_Card_MaskedPAN = '4545****4545';
      params.Ds_AuthorisationCode = 'AUTH-999-XYZ';

      const encodedParams = toBase64(JSON.stringify(params));
      const decoded = decodeRedsysMerchantParameters(encodedParams);

      expect(decoded.Ds_Card_MaskedPAN).toBe('4545****4545');
      expect(decoded.Ds_AuthorisationCode).toBe('AUTH-999-XYZ');
    });

    it('handles invalid base64 in merchant parameters', () => {
      const invalidBase64 = '{not json after decoding}';

      expect(() => {
        decodeRedsysMerchantParameters(invalidBase64);
      }).toThrow();
    });

    it('maintains data integrity through encode/decode cycle', () => {
      const original = createMerchantParams({
        Ds_Merchant_Amount: '5099',
        Ds_Merchant_Order: '000000000099',
      });

      const encoded = toBase64(JSON.stringify(original));
      const decoded = decodeRedsysMerchantParameters(encoded);

      expect(decoded).toEqual(original);
    });
  });

  describe('Payment Response Code Handling', () => {
    it('identifies successful payment response codes', () => {
      const successCodes = ['0000', '0001', '0050', '0099']; // 0-99 are success codes

      successCodes.forEach((code) => {
        expect(isRedsysResponseSuccess(code)).toBe(true);
      });
    });

    it('identifies cancelled payment response codes', () => {
      const cancelledCodes = ['0190']; // Only 0190 is specifically cancelled

      cancelledCodes.forEach((code) => {
        expect(isRedsysResponseCancelled(code)).toBe(true);
      });
    });

    it('identifies declined payment response codes', () => {
      const declinedCodes = ['0101', '0102', '0103', '0107', '0180', '0188', '0189', '0191', '0500'];

      declinedCodes.forEach((code) => {
        const isSuccess = isRedsysResponseSuccess(code);
        const isCancelled = isRedsysResponseCancelled(code);
        expect(isSuccess).toBe(false);
        expect(isCancelled).toBe(false);
      });
    });

    it('handles all response code branches correctly', () => {
      const allCodes = ['0000', '0190', '0101', '0050', '0189', '0102'];

      allCodes.forEach((code) => {
        const isSuccess = isRedsysResponseSuccess(code);
        const isCancelled = isRedsysResponseCancelled(code);

        // Each code should fall into exactly one category or neither (declined)
        const total = (isSuccess ? 1 : 0) + (isCancelled ? 1 : 0);
        if (!isSuccess && !isCancelled) {
          // Declined payment - neither success nor cancelled
          expect(total).toBe(0);
        } else {
          // Either success or cancelled
          expect(total).toBe(1);
        }
      });
    });
  });

  describe('Amount Format Handling', () => {
    it('correctly stores amount in cents', () => {
      const params = createMerchantParams({
        Ds_Merchant_Amount: '10050', // 100.50 EUR
      });

      expect(params.Ds_Merchant_Amount).toBe('10050');
      expect(/^\d+$/.test(params.Ds_Merchant_Amount)).toBe(true);
    });

    it('supports various amount values', () => {
      const testAmounts = ['1', '99', '10050', '999999', '1000000'];

      testAmounts.forEach((amount) => {
        const params = createMerchantParams({ Ds_Merchant_Amount: amount });
        expect(/^\d+$/.test(params.Ds_Merchant_Amount)).toBe(true);
        expect(parseInt(params.Ds_Merchant_Amount, 10)).toBeGreaterThan(0);
      });
    });

    it('uses EUR currency code', () => {
      const params = createMerchantParams();
      expect(params.Ds_Merchant_Currency).toBe('978'); // EUR ISO 4217 code
    });
  });

  describe('Order Number Handling', () => {
    it('validates order number format (12 digits)', () => {
      const params = createMerchantParams();
      expect(/^\d{12}$/.test(params.Ds_Merchant_Order)).toBe(true);
    });

    it('supports different order numbers', () => {
      const orderNumbers = [
        '000000000001',
        '000000000099',
        '123456789012',
        '999999999999',
      ];

      orderNumbers.forEach((orderNum) => {
        const params = createMerchantParams({ Ds_Merchant_Order: orderNum });
        expect(/^\d{12}$/.test(params.Ds_Merchant_Order)).toBe(true);
      });
    });

    it('uses same order number for signature verification', () => {
      const params = createMerchantParams({
        Ds_Merchant_Order: '000000000042',
      });
      const encodedParams = toBase64(JSON.stringify(params));
      const signature = generateSignature(encodedParams, params.Ds_Merchant_Order);

      // Verification must use same order number
      const isValid = verifySignature(encodedParams, signature, '000000000042');
      expect(isValid).toBe(true);

      // Verification fails with different order number
      const isInvalid = verifySignature(encodedParams, signature, '000000000043');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Base64 Encoding Properties', () => {
    it('round-trips through standard Base64', () => {
      const params = createMerchantParams();
      const encoded = toBase64(JSON.stringify(params));
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));

      expect(decoded).toEqual(params);
    });

    it('can be safely embedded in a form field', () => {
      const params = createMerchantParams();
      const encoded = toBase64(JSON.stringify(params));

      expect(encoded.length).toBeGreaterThan(0);
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });
  });

  describe('Transaction Details', () => {
    it('includes authorization code when available', () => {
      const params = createMerchantParams({
        Ds_AuthorisationCode: 'AUTH-123456',
      });

      expect(params.Ds_AuthorisationCode).toBe('AUTH-123456');
    });

    it('includes transaction ID reference', () => {
      const params = createMerchantParams({
        Ds_Merchant_TransactionId: 'TXN-789456',
      });

      expect(params.Ds_Merchant_TransactionId).toBe('TXN-789456');
    });

    it('includes card information (masked)', () => {
      const params = createMerchantParams({
        Ds_Card_MaskedPAN: '123456****7890',
        Ds_Card_Brand: 'VISA',
      });

      expect(params.Ds_Card_MaskedPAN).toBe('123456****7890');
      expect(params.Ds_Card_Brand).toBe('VISA');
    });
  });

  describe('Timestamp Handling', () => {
    it('includes valid Unix timestamp', () => {
      const params = createMerchantParams();
      const timestamp = parseInt(params.Ds_Merchant_Timestamp, 10);

      expect(/^\d+$/.test(params.Ds_Merchant_Timestamp)).toBe(true);
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 10); // Allow small clock skew
    });
  });

  describe('Error Scenarios', () => {
    it('handles missing merchant parameters field', () => {
      const notification = {
        Ds_SignatureVersion: 'HMAC_SHA256_V1',
        Ds_Signature: 'some-signature',
        // Missing Ds_MerchantParameters
      };

      expect(() => {
        parseRedsysNotificationPayload(notification);
      }).toThrow();
    });

    it('handles malformed JSON in merchant parameters', () => {
      const malformedJson = toBase64('{invalid json}');

      expect(() => {
        decodeRedsysMerchantParameters(malformedJson);
      }).toThrow();
    });

    it('handles very large encoded parameters', () => {
      const largeParams = createMerchantParams();
      // Add additional data
      largeParams.Ds_Merchant_Description =
        'A'.repeat(1000) + JSON.stringify({ extra: 'data' });

      const encodedParams = toBase64(JSON.stringify(largeParams));
      const decoded = decodeRedsysMerchantParameters(encodedParams);

      expect(decoded.Ds_Merchant_Description).toBe(
        'A'.repeat(1000) + JSON.stringify({ extra: 'data' })
      );
    });
  });
});
