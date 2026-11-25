import { getMadridDateString, parseMadridLocalDateTime } from '@/lib/lottery/core';

/**
 * The current Madrid calendar date and the preceding (days - 1) dates form
 * the window; the caller must also exclude payments later than `now`.
 */
export function getLoyaltyWindowStart(now: Date, days: number): Date {
  if (!Number.isFinite(now.getTime()) || !Number.isSafeInteger(days) || days < 1 || days > 36500) {
    throw new Error('Invalid loyalty window');
  }
  const [year, month, day] = getMadridDateString(now).split('-').map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day - days + 1));
  const dateOnly = calendarDate.toISOString().slice(0, 10);
  const start = parseMadridLocalDateTime(`${dateOnly}T00:00`);
  if (!start) throw new Error('Unable to resolve loyalty window start');
  return start;
}
