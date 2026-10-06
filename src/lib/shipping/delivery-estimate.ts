function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Returns an estimated delivery range (e.g. "3-4 de octubre") computed as
 * today + 2 to today + 3 business days (Mon-Fri, no holiday calendar).
 */
export function getEstimatedDeliveryRange(
  now: Date = new Date(),
  locale: string = 'es-ES',
): string {
  const start = addBusinessDays(now, 2);
  const end = addBusinessDays(now, 3);

  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(end);

  if (startMonth === endMonth) {
    return `${start.getDate()}-${end.getDate()} de ${startMonth}`;
  }

  return `${start.getDate()} de ${startMonth} - ${end.getDate()} de ${endMonth}`;
}
