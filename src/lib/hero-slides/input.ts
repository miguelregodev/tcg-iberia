/**
 * Request body parsing for admin hero slide endpoints. Pure: no database or network access.
 */
import type { HeroSlideInput } from '@/types';
import { normalizeHeroDestination } from './destination';

export const HERO_NAME_MAX_LENGTH = 255;
export const HERO_IMAGE_URL_MAX_LENGTH = 500;
export const HERO_HEADLINE_MAX_LENGTH = 160;
export const HERO_BUTTON_LABEL_MAX_LENGTH = 60;
export const HERO_SUBTITLE_MAX_LENGTH = 240;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses a create (`partial=false`) or update (`partial=true`) payload.
 * Create requires every field. Update accepts any subset, but at least one field must be present.
 */
export function parseHeroSlideInput(
  body: unknown,
  options: { partial: boolean }
): ParseResult<Partial<HeroSlideInput>> {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Cuerpo de la petición no válido.' };
  }

  const out: Partial<HeroSlideInput> = {};

  if (body.name !== undefined || !options.partial) {
    if (typeof body.name !== 'string') return { ok: false, error: 'El nombre es obligatorio.' };
    const name = body.name.trim();
    if (name.length === 0 || name.length > HERO_NAME_MAX_LENGTH) {
      return { ok: false, error: `El nombre debe tener entre 1 y ${HERO_NAME_MAX_LENGTH} caracteres.` };
    }
    out.name = name;
  }

  if (body.imageUrl !== undefined || !options.partial) {
    if (typeof body.imageUrl !== 'string' || body.imageUrl.trim().length === 0) {
      return { ok: false, error: 'La imagen es obligatoria.' };
    }
    const imageUrl = body.imageUrl.trim();
    if (imageUrl.length > HERO_IMAGE_URL_MAX_LENGTH) {
      return { ok: false, error: 'La URL de la imagen es demasiado larga.' };
    }
    out.imageUrl = imageUrl;
  }

  if (body.destinationUrl !== undefined || !options.partial) {
    if (typeof body.destinationUrl !== 'string') {
      return { ok: false, error: 'El destino es obligatorio.' };
    }
    const destination = normalizeHeroDestination(body.destinationUrl);
    if (!destination.ok) return { ok: false, error: destination.error };
    out.destinationUrl = destination.value;
  }

  if (body.headline !== undefined || !options.partial) {
    if (body.headline !== undefined && body.headline !== null && typeof body.headline !== 'string') {
      return { ok: false, error: 'El texto debe ser una cadena.' };
    }
    const headline = typeof body.headline === 'string' ? body.headline.trim() : '';
    if (headline.length > HERO_HEADLINE_MAX_LENGTH) {
      return { ok: false, error: `El texto no puede superar ${HERO_HEADLINE_MAX_LENGTH} caracteres.` };
    }
    out.headline = headline.length > 0 ? headline : null;
  }

  if (body.buttonLabel !== undefined || !options.partial) {
    if (body.buttonLabel !== undefined && body.buttonLabel !== null && typeof body.buttonLabel !== 'string') {
      return { ok: false, error: 'La etiqueta del botón debe ser una cadena.' };
    }
    const buttonLabel = typeof body.buttonLabel === 'string' ? body.buttonLabel.trim() : '';
    if (buttonLabel.length > HERO_BUTTON_LABEL_MAX_LENGTH) {
      return { ok: false, error: `La etiqueta del botón no puede superar ${HERO_BUTTON_LABEL_MAX_LENGTH} caracteres.` };
    }
    out.buttonLabel = buttonLabel.length > 0 ? buttonLabel : null;
  }

  if (body.subtitle !== undefined || !options.partial) {
    if (body.subtitle !== undefined && body.subtitle !== null && typeof body.subtitle !== 'string') {
      return { ok: false, error: 'El subtítulo debe ser una cadena.' };
    }
    const subtitle = typeof body.subtitle === 'string' ? body.subtitle.trim() : '';
    if (subtitle.length > HERO_SUBTITLE_MAX_LENGTH) {
      return { ok: false, error: `El subtítulo no puede superar ${HERO_SUBTITLE_MAX_LENGTH} caracteres.` };
    }
    out.subtitle = subtitle.length > 0 ? subtitle : null;
  }

  if (body.isActive !== undefined || !options.partial) {
    if (body.isActive === undefined) {
      out.isActive = true;
    } else if (typeof body.isActive !== 'boolean') {
      return { ok: false, error: 'isActive debe ser booleano.' };
    } else {
      out.isActive = body.isActive;
    }
  }

  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== 'number' || !Number.isInteger(body.sortOrder) || body.sortOrder < 0) {
      return { ok: false, error: 'La posición debe ser un entero mayor o igual que 0.' };
    }
    out.sortOrder = body.sortOrder;
  }

  if (options.partial && Object.keys(out).length === 0) {
    return { ok: false, error: 'No hay campos para actualizar.' };
  }

  return { ok: true, value: out };
}

/** Parses the reorder payload `{ ids: string[] }`. */
export function parseReorderInput(body: unknown): ParseResult<string[]> {
  if (!isPlainObject(body) || !Array.isArray(body.ids)) {
    return { ok: false, error: 'Se requiere un array "ids".' };
  }
  if (!body.ids.every((id) => typeof id === 'string' && id.length > 0)) {
    return { ok: false, error: 'Todos los ids deben ser cadenas no vacías.' };
  }
  const ids = body.ids as string[];
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: 'Los ids no pueden repetirse.' };
  }
  return { ok: true, value: ids };
}
