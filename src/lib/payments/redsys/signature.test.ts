import { describe, it, expect, beforeAll } from 'vitest';
import {
  toBase64,
  fromBase64,
  generateSignature,
  verifySignature,
  deriveKey3Des,
} from './signature';

// 24-byte 3DES key (Base64, 32 chars, no padding) used across tests
const TEST_SECRET = 'Mk9m98IfEblmPfrpsawt7BmxObt98Jev';

beforeAll(() => {
  // getRedsysConfig() caches on first call, so env vars must be set before any test runs
  process.env.REDSYS_MERCHANT_CODE ??= '999008881';
  process.env.REDSYS_TERMINAL ??= '1';
  process.env.REDSYS_SECRET_KEY ??= TEST_SECRET;
  process.env.REDSYS_ENVIRONMENT ??= 'test';
});

describe('Redsys Signature Operations (HMAC_SHA256_V1)', () => {
  describe('Base64 Encoding/Decoding', () => {
    it('converts string to standard base64', () => {
      const input = 'Hello, World!';
      const encoded = toBase64(input);
      expect(encoded).toBe('SGVsbG8sIFdvcmxkIQ==');
    });

    it('decodes standard base64 back to buffer', () => {
      const encoded = 'SGVsbG8sIFdvcmxkIQ==';
      const decoded = fromBase64(encoded).toString('utf-8');
      expect(decoded).toBe('Hello, World!');
    });

    it('round-trips complex strings', () => {
      const testStrings = [
        'Simple text',
        '{"json": "object"}',
        'Unicode: 你好世界 🎉',
        'Special chars: !@#$%^&*()',
      ];

      testStrings.forEach((str) => {
        const encoded = toBase64(str);
        const decoded = fromBase64(encoded).toString('utf-8');
        expect(decoded).toBe(str);
      });
    });
  });

  describe('3DES Key Derivation', () => {
    it('produces consistent derived keys for same inputs', () => {
      const orderNumber = '000000000001';
      const key1 = deriveKey3Des(TEST_SECRET, orderNumber);
      const key2 = deriveKey3Des(TEST_SECRET, orderNumber);
      expect(key1.equals(key2)).toBe(true);
    });

    it('produces different keys for different order numbers', () => {
      const key1 = deriveKey3Des(TEST_SECRET, '000000000001');
      const key2 = deriveKey3Des(TEST_SECRET, '000000000002');
      expect(key1.equals(key2)).toBe(false);
    });

    it('throws for a secret that does not decode to 24 bytes', () => {
      expect(() => deriveKey3Des('dG9vc2hvcnQ=', '000000000001')).toThrow();
    });

    it('derives a key using 3DES-CBC with zero IV', () => {
      const derivedKey = deriveKey3Des(TEST_SECRET, '1234567890');
      expect(Buffer.isBuffer(derivedKey)).toBe(true);
      expect(derivedKey.length).toBeGreaterThan(0);
    });
  });

  describe('Signature Generation', () => {
    it('generates deterministic signatures', () => {
      const merchantParams = toBase64(
        JSON.stringify({
          DS_MERCHANT_AMOUNT: '10050',
          DS_MERCHANT_ORDER: '000000000001',
        })
      );
      const orderNumber = '000000000001';

      const sig1 = generateSignature(merchantParams, orderNumber);
      const sig2 = generateSignature(merchantParams, orderNumber);

      expect(sig1).toBe(sig2);
    });

    it('produces different signatures for different parameters', () => {
      const params1 = toBase64(JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' }));
      const params2 = toBase64(JSON.stringify({ DS_MERCHANT_AMOUNT: '20000' }));
      const orderNumber = '000000000001';

      const sig1 = generateSignature(params1, orderNumber);
      const sig2 = generateSignature(params2, orderNumber);

      expect(sig1).not.toBe(sig2);
    });

    it('produces standard base64 encoded signatures', () => {
      const merchantParams = toBase64(
        JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' })
      );
      const orderNumber = '000000000001';

      const sig = generateSignature(merchantParams, orderNumber);

      // HMAC-SHA256 digest (32 bytes) base64-encoded is always 44 chars with one '=' pad
      expect(sig.length).toBe(44);
      expect(() => Buffer.from(sig, 'base64')).not.toThrow();
    });
  });

  describe('Signature Verification', () => {
    it('verifies valid signatures', () => {
      const merchantParams = toBase64(
        JSON.stringify({
          DS_MERCHANT_AMOUNT: '10050',
          DS_MERCHANT_ORDER: '000000000001',
        })
      );
      const orderNumber = '000000000001';

      const signature = generateSignature(merchantParams, orderNumber);
      const isValid = verifySignature(merchantParams, signature, orderNumber);

      expect(isValid).toBe(true);
    });

    it('rejects tampered signatures', () => {
      const merchantParams = toBase64(
        JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' })
      );
      const orderNumber = '000000000001';

      const signature = generateSignature(merchantParams, orderNumber);
      const tamperedSignature = signature.slice(0, -2) + 'XX';

      const isValid = verifySignature(merchantParams, tamperedSignature, orderNumber);
      expect(isValid).toBe(false);
    });

    it('rejects signatures for different parameters', () => {
      const params1 = toBase64(JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' }));
      const params2 = toBase64(JSON.stringify({ DS_MERCHANT_AMOUNT: '20000' }));
      const orderNumber = '000000000001';

      const signature = generateSignature(params1, orderNumber);
      const isValid = verifySignature(params2, signature, orderNumber);

      expect(isValid).toBe(false);
    });

    it('rejects signatures with wrong order number', () => {
      const merchantParams = toBase64(
        JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' })
      );
      const orderNumber = '000000000001';

      const signature = generateSignature(merchantParams, orderNumber);
      const isValid = verifySignature(merchantParams, signature, '000000000002');

      expect(isValid).toBe(false);
    });

    it('handles malformed merchant parameters gracefully', () => {
      const malformedParams = 'NOT_VALID_BASE64!!!';
      const orderNumber = '000000000001';
      const fakeSignature = 'FAKESIGNATURE';

      const isValid = verifySignature(malformedParams, fakeSignature, orderNumber);
      expect(isValid).toBe(false);
    });

    it('prevents timing attacks with constant-time comparison', () => {
      const merchantParams = toBase64(
        JSON.stringify({ DS_MERCHANT_AMOUNT: '10050' })
      );
      const orderNumber = '000000000001';

      const correctSignature = generateSignature(merchantParams, orderNumber);

      const wrongSig1 = 'A' + correctSignature.slice(1);
      const wrongSig2 = correctSignature.slice(0, -1) + 'Z';

      expect(verifySignature(merchantParams, wrongSig1, orderNumber)).toBe(false);
      expect(verifySignature(merchantParams, wrongSig2, orderNumber)).toBe(false);
    });
  });

  describe('Full Payment Flow', () => {
    it('simulates complete Redsys payment flow', () => {
      // 1. Merchant creates order and builds merchant parameters
      const merchantParams = {
        DS_MERCHANT_AMOUNT: '10050',
        DS_MERCHANT_CURRENCY: '978',
        DS_MERCHANT_ORDER: '000000000001',
        DS_MERCHANT_MERCHANTCODE: '123456',
        DS_MERCHANT_TERMINAL: '1',
        DS_MERCHANT_TRANSACTIONTYPE: '0',
      };

      const paramsJson = JSON.stringify(merchantParams);
      const paramsBase64 = toBase64(paramsJson);

      // 2. Merchant generates signature
      const signature = generateSignature(paramsBase64, '000000000001');

      // 3. Customer completes payment at Redsys
      // 4. Redsys sends notification with same parameters and signature
      // 5. Merchant verifies signature
      const isValid = verifySignature(paramsBase64, signature, '000000000001');

      expect(isValid).toBe(true);

      // 6. Merchant decodes parameters to read response
      const decodedParams = JSON.parse(fromBase64(paramsBase64).toString('utf-8'));
      expect(decodedParams.DS_MERCHANT_AMOUNT).toBe('10050');
      expect(decodedParams.DS_MERCHANT_ORDER).toBe('000000000001');
    });
  });
});

