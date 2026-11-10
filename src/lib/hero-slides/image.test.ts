import { describe, expect, it } from 'vitest';
import {
  detectHeroImageFormat,
  isAcceptedHeroAspectRatio,
  readHeroImageDimensions,
  validateHeroImage,
} from './image';

function pngHeader(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.set([0, 0, 0, 13], 8);
  buf.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

function jpegSof(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x02, // APP0 with empty payload
    0xff, 0xc0, 0x00, 0x11, 0x08, // SOF0 header
    height >> 8, height & 0xff,
    width >> 8, width & 0xff,
  ]);
}

function webpVp8x(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(30);
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  buf.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const w = width - 1;
  const h = height - 1;
  buf.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  buf.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);
  return buf;
}

describe('detectHeroImageFormat', () => {
  it('detects jpeg, png and webp', () => {
    expect(detectHeroImageFormat(jpegSof(1920, 1080))).toBe('jpeg');
    expect(detectHeroImageFormat(pngHeader(1920, 1080))).toBe('png');
    expect(detectHeroImageFormat(webpVp8x(1920, 1080))).toBe('webp');
  });

  it('rejects GIF', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    expect(detectHeroImageFormat(gif)).toBeNull();
  });
});

describe('readHeroImageDimensions', () => {
  it('reads PNG dimensions', () => {
    expect(readHeroImageDimensions(pngHeader(1920, 1080), 'png')).toEqual({ width: 1920, height: 1080 });
  });

  it('reads JPEG dimensions from SOF', () => {
    expect(readHeroImageDimensions(jpegSof(1600, 900), 'jpeg')).toEqual({ width: 1600, height: 900 });
  });

  it('reads WebP VP8X canvas dimensions', () => {
    expect(readHeroImageDimensions(webpVp8x(2560, 1440), 'webp')).toEqual({ width: 2560, height: 1440 });
  });
});

describe('isAcceptedHeroAspectRatio', () => {
  it('accepts 16:9 and 16:10', () => {
    expect(isAcceptedHeroAspectRatio(1920, 1080)).toBe(true);
    expect(isAcceptedHeroAspectRatio(1280, 800)).toBe(true);
  });

  it('rejects other ratios', () => {
    expect(isAcceptedHeroAspectRatio(1000, 1000)).toBe(false);
    expect(isAcceptedHeroAspectRatio(1920, 1000)).toBe(false);
  });
});

describe('validateHeroImage', () => {
  it('accepts a valid 1920x1080 PNG', () => {
    const result = validateHeroImage(pngHeader(1920, 1080));
    expect(result).toEqual({ ok: true, format: 'png', width: 1920, height: 1080 });
  });

  it('rejects images narrower than 1280 px', () => {
    expect(validateHeroImage(pngHeader(1152, 648)).ok).toBe(false);
  });

  it('rejects unsupported aspect ratios', () => {
    expect(validateHeroImage(pngHeader(1920, 1000)).ok).toBe(false);
  });

  it('rejects empty buffers', () => {
    expect(validateHeroImage(new Uint8Array(0)).ok).toBe(false);
  });
});
