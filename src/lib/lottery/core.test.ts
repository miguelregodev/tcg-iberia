import { describe, expect, it } from 'vitest';
import {
  canDeleteLottery,
  getLotteryEditMode,
  getLotteryTransition,
  getMadridDateString,
  getParticipationBlockReason,
  isOrderDateInLotteryRange,
  normalizeOrderNumber,
  parseDateOnly,
  parseMadridLocalDateTime,
  pickWinnerIndex,
  slugifyLotteryTitle,
  validateLotteryWriteInput,
  validateParticipationInput,
} from './core';

describe('normalizeOrderNumber', () => {
  it('trims, removes inner whitespace and uppercases for dedupe', () => {
    expect(normalizeOrderNumber('  tcg-20260510-000123 ')).toBe('TCG-20260510-000123');
    expect(normalizeOrderNumber('AB 12 34')).toBe('AB1234');
  });
});

describe('Europe/Madrid conversions', () => {
  it('parses local summer time as UTC+2', () => {
    const date = parseMadridLocalDateTime('2026-07-01T10:00');
    expect(date?.toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });

  it('parses local winter time as UTC+1', () => {
    const date = parseMadridLocalDateTime('2026-01-15T10:00');
    expect(date?.toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });

  it('rejects malformed and non-existent local times', () => {
    expect(parseMadridLocalDateTime('2026-13-01T10:00')).toBeNull();
    expect(parseMadridLocalDateTime('not a date')).toBeNull();
    // 2026-03-29 02:30 does not exist in Madrid (DST spring-forward gap).
    expect(parseMadridLocalDateTime('2026-03-29T02:30')).toBeNull();
  });

  it('returns the Madrid calendar day for an instant near midnight UTC', () => {
    // 2026-07-01T23:30Z is already 2026-07-02 in Madrid.
    expect(getMadridDateString(new Date('2026-07-01T23:30:00.000Z'))).toBe('2026-07-02');
  });
});

describe('parseDateOnly', () => {
  it('accepts real calendar dates only', () => {
    expect(parseDateOnly('2026-02-28')).toBe('2026-02-28');
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('28/02/2026')).toBeNull();
  });
});

describe('isOrderDateInLotteryRange', () => {
  const start = parseMadridLocalDateTime('2026-06-10T00:00')!;
  const end = parseMadridLocalDateTime('2026-06-20T23:59')!;

  it('accepts dates inside the range, inclusive on both ends', () => {
    expect(isOrderDateInLotteryRange('2026-06-10', start, end)).toBe(true);
    expect(isOrderDateInLotteryRange('2026-06-15', start, end)).toBe(true);
    expect(isOrderDateInLotteryRange('2026-06-20', start, end)).toBe(true);
  });

  it('rejects dates before or after the range', () => {
    expect(isOrderDateInLotteryRange('2026-06-09', start, end)).toBe(false);
    expect(isOrderDateInLotteryRange('2026-06-21', start, end)).toBe(false);
  });
});

describe('getLotteryTransition', () => {
  it('allows the documented lifecycle transitions', () => {
    expect(getLotteryTransition('publish', 'DRAFT')).toBe('SCHEDULED');
    expect(getLotteryTransition('start', 'SCHEDULED')).toBe('ACTIVE');
    expect(getLotteryTransition('start', 'DRAFT')).toBe('ACTIVE');
    expect(getLotteryTransition('finish', 'ACTIVE')).toBe('FINISHED');
    expect(getLotteryTransition('cancel', 'ACTIVE')).toBe('CANCELLED');
  });

  it('rejects transitions out of order', () => {
    expect(getLotteryTransition('finish', 'DRAFT')).toBeNull();
    expect(getLotteryTransition('start', 'FINISHED')).toBeNull();
    expect(getLotteryTransition('cancel', 'DRAWN')).toBeNull();
    expect(getLotteryTransition('publish', 'ACTIVE')).toBeNull();
  });
});

describe('edit and delete rules', () => {
  it('locks dates once active and locks everything after finish', () => {
    expect(getLotteryEditMode('DRAFT')).toBe('full');
    expect(getLotteryEditMode('SCHEDULED')).toBe('full');
    expect(getLotteryEditMode('ACTIVE')).toBe('active');
    expect(getLotteryEditMode('FINISHED')).toBe('locked');
    expect(getLotteryEditMode('DRAWN')).toBe('locked');
  });

  it('only deletes empty drafts or cancelled lotteries', () => {
    expect(canDeleteLottery('DRAFT', 0)).toBe(true);
    expect(canDeleteLottery('CANCELLED', 0)).toBe(true);
    expect(canDeleteLottery('DRAFT', 1)).toBe(false);
    expect(canDeleteLottery('ACTIVE', 0)).toBe(false);
    expect(canDeleteLottery('DRAWN', 0)).toBe(false);
  });
});

describe('getParticipationBlockReason', () => {
  const start = new Date('2026-06-10T00:00:00.000Z');
  const end = new Date('2026-06-20T00:00:00.000Z');
  const during = new Date('2026-06-15T12:00:00.000Z');

  it('is open only while active and inside the date window', () => {
    expect(getParticipationBlockReason('ACTIVE', start, end, during)).toBeNull();
  });

  it('blocks before the start date and after the end date', () => {
    expect(getParticipationBlockReason('ACTIVE', start, end, new Date('2026-06-09T12:00:00.000Z'))).toBe('NOT_STARTED');
    expect(getParticipationBlockReason('ACTIVE', start, end, end)).toBe('ENDED');
    expect(getParticipationBlockReason('FINISHED', start, end, during)).toBe('ENDED');
  });

  it('blocks drafts, cancelled and drawn lotteries', () => {
    expect(getParticipationBlockReason('DRAFT', start, end, during)).toBe('UNAVAILABLE');
    expect(getParticipationBlockReason('CANCELLED', start, end, during)).toBe('UNAVAILABLE');
    expect(getParticipationBlockReason('DRAWN', start, end, during)).toBe('ENDED');
  });
});

describe('validateParticipationInput', () => {
  const base = { orderNumber: ' tcg-001 ', platform: 'WEBSITE', orderDate: '2026-06-12' };

  it('accepts a website purchase without a TikTok username', () => {
    const result = validateParticipationInput({ ...base, tiktokUsername: '@ignored' });
    expect(result).toEqual({
      ok: true,
      value: {
        orderNumber: 'tcg-001',
        normalizedOrderNumber: 'TCG-001',
        platform: 'WEBSITE',
        tiktokUsername: null,
        orderDate: '2026-06-12',
      },
    });
  });

  it('requires a valid TikTok username for TikTok purchases', () => {
    expect(validateParticipationInput({ ...base, platform: 'TIKTOK' }).ok).toBe(false);
    expect(validateParticipationInput({ ...base, platform: 'TIKTOK', tiktokUsername: 'a b' }).ok).toBe(false);
    const ok = validateParticipationInput({ ...base, platform: 'TIKTOK', tiktokUsername: '@tcg_fan' });
    expect(ok.ok && ok.value.tiktokUsername).toBe('@tcg_fan');
  });

  it('rejects unknown platforms and invalid dates', () => {
    expect(validateParticipationInput({ ...base, platform: 'AMAZON' }).ok).toBe(false);
    expect(validateParticipationInput({ ...base, orderDate: '2026-02-31' }).ok).toBe(false);
  });
});

describe('validateLotteryWriteInput', () => {
  const base = {
    title: 'Sorteo Verano',
    prize: 'Caja de Pokémon',
    description: 'Compra y participa.',
    startDate: '2026-06-10T10:00',
    endDate: '2026-06-20T20:00',
  };

  it('accepts a complete lottery', () => {
    const result = validateLotteryWriteInput({ ...base, minimumOrderAmount: '25.50' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.minimumOrderAmount).toBe(25.5);
  });

  it('rejects an end date that is not after the start date', () => {
    const result = validateLotteryWriteInput({ ...base, endDate: '2026-06-10T10:00' });
    expect(result.ok).toBe(false);
  });

  it('rejects amounts with more than two decimals and negative amounts', () => {
    expect(validateLotteryWriteInput({ ...base, minimumOrderAmount: '10.123' }).ok).toBe(false);
    expect(validateLotteryWriteInput({ ...base, minimumOrderAmount: '-1' }).ok).toBe(false);
  });
});

describe('slugifyLotteryTitle', () => {
  it('builds URL-safe slugs without accents', () => {
    expect(slugifyLotteryTitle('  Sorteo de Verano: Pokémon!  ')).toBe('sorteo-de-verano-pokemon');
  });
});

describe('pickWinnerIndex', () => {
  it('returns an index within the eligible range using the injected source', () => {
    expect(pickWinnerIndex(5, () => 4)).toBe(4);
    expect(pickWinnerIndex(1)).toBe(0);
  });

  it('throws when there are no eligible participations', () => {
    expect(() => pickWinnerIndex(0)).toThrow('NO_ELIGIBLE_PARTICIPATIONS');
  });

  it('throws when the random source returns an out-of-range index', () => {
    expect(() => pickWinnerIndex(3, () => 3)).toThrow('INVALID_RANDOM_INDEX');
  });
});
