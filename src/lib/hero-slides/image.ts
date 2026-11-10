/**
 * Pure image inspection helpers for hero slide uploads.
 * Reads format and dimensions from magic bytes / headers without any dependency.
 */

export const HERO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const HERO_IMAGE_MIN_WIDTH = 1280;
/** Accepted aspect ratios (width / height) */
export const HERO_IMAGE_ASPECT_RATIOS = [16 / 9, 16 / 10] as const;
const ASPECT_TOLERANCE = 0.01;

export type HeroImageFormat = 'jpeg' | 'png' | 'webp';

export const HERO_IMAGE_MIME: Record<HeroImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const HERO_IMAGE_EXTENSION: Record<HeroImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

export interface HeroImageInfo {
  format: HeroImageFormat;
  width: number;
  height: number;
}

export type HeroImageValidation =
  | ({ ok: true } & HeroImageInfo)
  | { ok: false; error: string };

function ascii(buf: Uint8Array, start: number, length: number): string {
  let out = '';
  for (let i = start; i < start + length && i < buf.length; i++) {
    out += String.fromCharCode(buf[i]);
  }
  return out;
}

function u16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

function u32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function u16LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}

function u24LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

/** Detects JPEG, PNG or WebP from magic bytes. Returns null for anything else (including GIF and AVIF). */
export function detectHeroImageFormat(buf: Uint8Array): HeroImageFormat | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    ascii(buf, 1, 3) === 'PNG' &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') {
    return 'webp';
  }
  return null;
}

function readPngDimensions(b: Uint8Array): { width: number; height: number } | null {
  // IHDR must be the first chunk: length(4) type(4) width(4) height(4) at offset 8.
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return null;
  return { width: u32BE(b, 16), height: u32BE(b, 20) };
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    marker !== 0xc4 && // DHT
    marker !== 0xc8 && // JPG extension
    marker !== 0xcc // DAC
  );
}

function readJpegDimensions(b: Uint8Array): { width: number; height: number } | null {
  let i = 2; // skip SOI
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === undefined) return null;
    if (marker === 0xff) {
      // fill byte
      i += 1;
      continue;
    }
    // Standalone markers without a length field
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > b.length) return null;
    if (isJpegStartOfFrame(marker)) {
      if (i + 9 > b.length) return null;
      return { height: u16BE(b, i + 5), width: u16BE(b, i + 7) };
    }
    const segmentLength = u16BE(b, i + 2);
    if (segmentLength < 2) return null;
    i += 2 + segmentLength;
  }
  return null;
}

function readWebpDimensions(b: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ') {
    // Lossy: frame tag signature 9d 01 2a at offset 23
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16LE(b, 26) & 0x3fff, height: u16LE(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    // Lossless: signature byte 0x2f at offset 20, then 14-bit width/height packed
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const b0 = b[21];
    const b1 = b[22];
    const b2 = b[23];
    const b3 = b[24];
    return {
      width: 1 + (b0 | ((b1 & 0x3f) << 8)),
      height: 1 + ((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)),
    };
  }
  if (chunk === 'VP8X') {
    // Extended: canvas width-1 (24-bit) at 24, height-1 (24-bit) at 27
    if (b.length < 30) return null;
    return { width: u24LE(b, 24) + 1, height: u24LE(b, 27) + 1 };
  }
  return null;
}

/** Reads pixel dimensions for an already-detected format. Returns null when headers are malformed. */
export function readHeroImageDimensions(
  buf: Uint8Array,
  format: HeroImageFormat
): { width: number; height: number } | null {
  let dims: { width: number; height: number } | null;
  switch (format) {
    case 'png':
      dims = readPngDimensions(buf);
      break;
    case 'jpeg':
      dims = readJpegDimensions(buf);
      break;
    case 'webp':
      dims = readWebpDimensions(buf);
      break;
  }
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  return dims;
}

/** Returns true when width/height is within tolerance of 16:9 or 16:10. */
export function isAcceptedHeroAspectRatio(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;
  return HERO_IMAGE_ASPECT_RATIOS.some((target) => Math.abs(ratio - target) / target <= ASPECT_TOLERANCE);
}

/** Full validation of a hero image buffer: size, format, dimensions, aspect ratio. */
export function validateHeroImage(buf: Uint8Array): HeroImageValidation {
  if (buf.length === 0) {
    return { ok: false, error: 'La imagen está vacía.' };
  }
  if (buf.length > HERO_IMAGE_MAX_BYTES) {
    return { ok: false, error: 'La imagen supera el tamaño máximo de 5 MB.' };
  }
  const format = detectHeroImageFormat(buf);
  if (!format) {
    return { ok: false, error: 'Formato no compatible. Usa JPEG, PNG o WebP.' };
  }
  const dims = readHeroImageDimensions(buf, format);
  if (!dims) {
    return { ok: false, error: 'No se pudieron leer las dimensiones de la imagen.' };
  }
  if (dims.width < HERO_IMAGE_MIN_WIDTH) {
    return {
      ok: false,
      error: `La imagen es demasiado estrecha (${dims.width} px). Mínimo ${HERO_IMAGE_MIN_WIDTH} px de ancho.`,
    };
  }
  if (!isAcceptedHeroAspectRatio(dims.width, dims.height)) {
    return {
      ok: false,
      error: `Proporción no válida (${dims.width}×${dims.height}). Usa 16:9 (p. ej. 1920×1080) o 16:10 (p. ej. 1920×1200).`,
    };
  }
  return { ok: true, format, width: dims.width, height: dims.height };
}
