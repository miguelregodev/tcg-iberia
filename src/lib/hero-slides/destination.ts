/**
 * Validation for hero slide destinations.
 * Allowed: internal paths starting with a single "/", or absolute https:// URLs.
 */

export const HERO_DESTINATION_MAX_LENGTH = 500;

const INTERNAL_BASE = 'https://internal.invalid';

export type DestinationResult = { ok: true; value: string } | { ok: false; error: string };

export function normalizeHeroDestination(raw: string): DestinationResult {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: 'El destino es obligatorio.' };
  }
  if (value.length > HERO_DESTINATION_MAX_LENGTH) {
    return { ok: false, error: `El destino no puede superar ${HERO_DESTINATION_MAX_LENGTH} caracteres.` };
  }
  // Whitespace, control characters and backslashes are never valid in a destination.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(value)) {
    return { ok: false, error: 'El destino no puede contener espacios, barras invertidas ni caracteres de control.' };
  }

  if (value.startsWith('/')) {
    // Protocol-relative URLs (//host) would leave the site.
    if (value.startsWith('//')) {
      return { ok: false, error: 'Las rutas internas no pueden empezar por "//".' };
    }
    try {
      const url = new URL(value, INTERNAL_BASE);
      if (url.origin !== INTERNAL_BASE) {
        return { ok: false, error: 'Ruta interna no válida.' };
      }
    } catch {
      return { ok: false, error: 'Ruta interna no válida.' };
    }
    return { ok: true, value };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: 'Usa una ruta interna (/...) o una URL completa https://.' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Solo se permiten URLs https://.' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'La URL no puede incluir credenciales.' };
  }
  return { ok: true, value: url.toString() };
}

/** True when the destination points outside the site. */
export function isExternalDestination(destination: string): boolean {
  return /^https?:\/\//i.test(destination);
}
