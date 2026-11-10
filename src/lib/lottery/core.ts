
/** Pure lottery business rules. No database or I/O access in this module. */

export const LOTTERY_TIME_ZONE = 'Europe/Madrid';

export const LOTTERY_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'FINISHED',
  'DRAWN',
  'CANCELLED',
] as const;
export type LotteryStatus = (typeof LOTTERY_STATUSES)[number];

export const PURCHASE_PLATFORMS = ['TIKTOK', 'WEBSITE'] as const;
export type LotteryPurchasePlatform = (typeof PURCHASE_PLATFORMS)[number];

export const PARTICIPATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type LotteryParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const REJECTION_REASONS = [
  'INVALID_ORDER_DATE',
  'MINIMUM_AMOUNT_NOT_MET',
  'ORDER_NOT_FOUND',
  'OTHER',
] as const;
export type LotteryRejectionReason = (typeof REJECTION_REASONS)[number];

export const REJECTION_REASON_LABELS: Record<LotteryRejectionReason, string> = {
  INVALID_ORDER_DATE: 'Fecha incorrecta del pedido',
  MINIMUM_AMOUNT_NOT_MET: 'Importe mínimo no alcanzado',
  ORDER_NOT_FOUND: 'Pedido no encontrado',
  OTHER: 'Otro',
};

export const LOTTERY_STATUS_LABELS: Record<LotteryStatus, string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programado',
  ACTIVE: 'Activo',
  FINISHED: 'Finalizado',
  DRAWN: 'Ganador elegido',
  CANCELLED: 'Cancelado',
};

export const LOTTERY_LIMITS = {
  titleMax: 160,
  prizeMax: 255,
  descriptionMax: 5000,
  prizeImageUrlMax: 500,
  rejectionDetailsMax: 500,
  minimumOrderAmountMax: 99999.99,
} as const;

export type LotteryAction = 'publish' | 'start' | 'finish' | 'cancel';

const ACTION_TRANSITIONS: Record<LotteryAction, { from: LotteryStatus[]; to: LotteryStatus }> = {
  publish: { from: ['DRAFT'], to: 'SCHEDULED' },
  start: { from: ['DRAFT', 'SCHEDULED'], to: 'ACTIVE' },
  finish: { from: ['ACTIVE'], to: 'FINISHED' },
  cancel: { from: ['DRAFT', 'SCHEDULED', 'ACTIVE'], to: 'CANCELLED' },
};

/** Returns the target status for a manual action, or null when the transition is not allowed. */
export function getLotteryTransition(action: LotteryAction, status: LotteryStatus): LotteryStatus | null {
  const rule = ACTION_TRANSITIONS[action];
  return rule.from.includes(status) ? rule.to : null;
}

export type LotteryEditMode = 'full' | 'active' | 'locked';

/**
 * Describes which lottery fields may still be edited.
 * DRAFT/SCHEDULED: everything. ACTIVE: content and end date only. Anything else: locked.
 */
export function getLotteryEditMode(status: LotteryStatus): LotteryEditMode {
  if (status === 'DRAFT' || status === 'SCHEDULED') return 'full';
  if (status === 'ACTIVE') return 'active';
  return 'locked';
}

export function canDeleteLottery(status: LotteryStatus, participationCount: number): boolean {
  return participationCount === 0 && (status === 'DRAFT' || status === 'CANCELLED');
}

// --- Europe/Madrid calendar helpers ---

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const madridFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LOTTERY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function getMadridParts(date: Date): ZonedParts {
  const parts = Object.fromEntries(
    madridFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Offset in ms between Europe/Madrid wall-clock time and UTC at the given instant. */
function getMadridOffsetMs(date: Date): number {
  const p = getMadridParts(date);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const instantSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return wallClockAsUtc - instantSeconds;
}

/** Returns the Europe/Madrid calendar date (YYYY-MM-DD) for an instant. */
export function getMadridDateString(date: Date): string {
  const p = getMadridParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Parses a `datetime-local` value (YYYY-MM-DDTHH:mm) interpreted as Europe/Madrid wall-clock time.
 * Returns null for malformed values or local times that do not exist (DST gap).
 */
export function parseMadridLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClockAsUtc - getMadridOffsetMs(new Date(wallClockAsUtc));
  instant = wallClockAsUtc - getMadridOffsetMs(new Date(instant));
  const result = new Date(instant);

  const p = getMadridParts(result);
  if (p.year !== year || p.month !== month || p.day !== day || p.hour !== hour || p.minute !== minute) {
    return null;
  }
  return result;
}

/** Validates a calendar date string (YYYY-MM-DD). Returns the normalized string or null. */
export function parseDateOnly(value: string): string | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return trimmed;
}

/**
 * An order date is valid when its calendar date (Europe/Madrid) falls within the
 * lottery's date range, inclusive on both ends.
 */
export function isOrderDateInLotteryRange(orderDate: string, startDate: Date, endDate: Date): boolean {
  return orderDate >= getMadridDateString(startDate) && orderDate <= getMadridDateString(endDate);
}

// --- Participation window ---

export type ParticipationBlockReason = 'UNAVAILABLE' | 'NOT_STARTED' | 'ENDED';

/** Returns why a participation cannot be submitted now, or null when it is open. */
export function getParticipationBlockReason(
  status: LotteryStatus,
  startDate: Date,
  endDate: Date,
  now: Date,
): ParticipationBlockReason | null {
  if (status === 'DRAFT' || status === 'CANCELLED') return 'UNAVAILABLE';
  if (status === 'FINISHED' || status === 'DRAWN' || now.getTime() >= endDate.getTime()) return 'ENDED';
  if (now.getTime() < startDate.getTime()) return 'NOT_STARTED';
  if (status !== 'ACTIVE') return 'UNAVAILABLE';
  return null;
}

// --- Input normalization and validation ---

/** Dedupe key for order numbers: trimmed, whitespace removed, uppercase. */
export function normalizeOrderNumber(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isValidOrderNumber(normalized: string): boolean {
  return /^[A-Z0-9][A-Z0-9_/-]{2,49}$/.test(normalized);
}

export function normalizeTikTokUsername(raw: string): string {
  return raw.trim();
}

export function isValidTikTokUsername(value: string): boolean {
  return /^@?[A-Za-z0-9._]{2,24}$/.test(value);
}

export function slugifyLotteryTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

export function isRejectionReason(value: unknown): value is LotteryRejectionReason {
  return typeof value === 'string' && (REJECTION_REASONS as readonly string[]).includes(value);
}

export function isPurchasePlatform(value: unknown): value is LotteryPurchasePlatform {
  return typeof value === 'string' && (PURCHASE_PLATFORMS as readonly string[]).includes(value);
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface LotteryParticipationInput {
  orderNumber: string;
  normalizedOrderNumber: string;
  platform: LotteryPurchasePlatform;
  tiktokUsername: string | null;
  orderDate: string;
}

export function validateParticipationInput(body: unknown): ValidationResult<LotteryParticipationInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Datos de participación no válidos.' };
  const input = body as Record<string, unknown>;

  const rawOrder = typeof input.orderNumber === 'string' ? input.orderNumber.trim() : '';
  const normalizedOrderNumber = normalizeOrderNumber(rawOrder);
  if (!normalizedOrderNumber || !isValidOrderNumber(normalizedOrderNumber)) {
    return { ok: false, error: 'Introduce un número de pedido válido.' };
  }

  if (!isPurchasePlatform(input.platform)) {
    return { ok: false, error: 'Selecciona dónde realizaste la compra.' };
  }

  let tiktokUsername: string | null = null;
  if (input.platform === 'TIKTOK') {
    const username = typeof input.tiktokUsername === 'string' ? normalizeTikTokUsername(input.tiktokUsername) : '';
    if (!username || !isValidTikTokUsername(username)) {
      return { ok: false, error: 'Introduce un nombre de usuario de TikTok válido.' };
    }
    tiktokUsername = username;
  }

  const orderDate = typeof input.orderDate === 'string' ? parseDateOnly(input.orderDate) : null;
  if (!orderDate) return { ok: false, error: 'Introduce una fecha de pedido válida.' };

  return {
    ok: true,
    value: {
      orderNumber: rawOrder,
      normalizedOrderNumber,
      platform: input.platform,
      tiktokUsername,
      orderDate,
    },
  };
}

export interface LotteryWriteInput {
  title: string;
  prize: string;
  description: string;
  prizeImageUrl: string | null;
  startDate: Date;
  endDate: Date;
  minimumOrderAmount: number | null;
}

function readTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

/** Validates admin lottery input. Dates are `datetime-local` values in Europe/Madrid time. */
export function validateLotteryWriteInput(body: unknown): ValidationResult<LotteryWriteInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Datos del sorteo no válidos.' };
  const input = body as Record<string, unknown>;

  const title = readTrimmedString(input.title, LOTTERY_LIMITS.titleMax);
  if (!title) return { ok: false, error: 'El título es obligatorio (máximo 160 caracteres).' };

  const prize = readTrimmedString(input.prize, LOTTERY_LIMITS.prizeMax);
  if (!prize) return { ok: false, error: 'El premio es obligatorio.' };

  const description = readTrimmedString(input.description, LOTTERY_LIMITS.descriptionMax);
  if (!description) return { ok: false, error: 'La descripción es obligatoria.' };

  let prizeImageUrl: string | null = null;
  if (input.prizeImageUrl !== undefined && input.prizeImageUrl !== null && input.prizeImageUrl !== '') {
    const url = readTrimmedString(input.prizeImageUrl, LOTTERY_LIMITS.prizeImageUrlMax);
    if (!url || !/^(https?:\/\/|\/)/.test(url)) {
      return { ok: false, error: 'La imagen del premio no es una URL válida.' };
    }
    prizeImageUrl = url;
  }

  const startDate = typeof input.startDate === 'string' ? parseMadridLocalDateTime(input.startDate) : null;
  if (!startDate) return { ok: false, error: 'Introduce una fecha de inicio válida.' };
  const endDate = typeof input.endDate === 'string' ? parseMadridLocalDateTime(input.endDate) : null;
  if (!endDate) return { ok: false, error: 'Introduce una fecha de fin válida.' };
  if (endDate.getTime() <= startDate.getTime()) {
    return { ok: false, error: 'La fecha de fin debe ser posterior a la fecha de inicio.' };
  }

  let minimumOrderAmount: number | null = null;
  if (input.minimumOrderAmount !== undefined && input.minimumOrderAmount !== null && input.minimumOrderAmount !== '') {
    const amount = Number(input.minimumOrderAmount);
    if (
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > LOTTERY_LIMITS.minimumOrderAmountMax ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return { ok: false, error: 'El importe mínimo debe ser un número positivo con hasta 2 decimales.' };
    }
    minimumOrderAmount = amount;
  }

  return {
    ok: true,
    value: { title, prize, description, prizeImageUrl, startDate, endDate, minimumOrderAmount },
  };
}

// --- Winner selection ---

/** Uniform integer in [0, max) from Web Crypto, with rejection sampling to avoid modulo bias. */
function secureRandomInt(max: number): number {
  const range = 0x100000000;
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

/**
 * Picks a uniformly random index in [0, count) using a CSPRNG.
 * `random` is injectable for tests.
 */
export function pickWinnerIndex(count: number, random: (max: number) => number = secureRandomInt): number {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('NO_ELIGIBLE_PARTICIPATIONS');
  }
  const index = random(count);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error('INVALID_RANDOM_INDEX');
  }
  return index;
}
