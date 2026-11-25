import { getMadridDateString, parseMadridLocalDateTime } from '@/lib/lottery/core';

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Adds calendar months in Madrid, clamping the day to the target month. */
export function calculateExpiration(earnedAt: Date, months: number): Date {
  if (!Number.isFinite(earnedAt.getTime()) || !Number.isSafeInteger(months) || months < 1 || months > 120) {
    throw new Error('Invalid expiration date or period');
  }
  const [year, month, day] = getMadridDateString(earnedAt).split('-').map(Number);
  const targetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  targetMonth.setUTCDate(Math.min(day, lastDay));
  const parts = Object.fromEntries(timeFormatter.formatToParts(earnedAt).map((part) => [part.type, part.value]));
  const wallTime = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), targetMonth.getUTCDate(), Number(parts.hour), Number(parts.minute)));

  // A local time may not exist during the spring DST transition.
  for (let minute = 0; minute <= 120; minute++) {
    const candidate = new Date(wallTime.getTime() + minute * 60_000);
    const value = `${candidate.toISOString().slice(0, 10)}T${candidate.toISOString().slice(11, 16)}`;
    const result = parseMadridLocalDateTime(value);
    if (result) return new Date(result.getTime() + earnedAt.getUTCSeconds() * 1000 + earnedAt.getUTCMilliseconds());
  }
  throw new Error('Cannot resolve expiration time');
}
