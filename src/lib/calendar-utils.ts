import type { CalendarDayData, CalendarProduct } from '@/types/releases';

/**
 * Groups products by their UTC day-of-month for the given year/month.
 */
export function groupProductsByDay(
  products: CalendarProduct[],
): Map<number, CalendarProduct[]> {
  const map = new Map<number, CalendarProduct[]>();
  for (const product of products) {
    const date = new Date(product.releaseDate);
    const day = date.getUTCDate();
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(product);
  }
  return map;
}

/**
 * Builds a 2-D array of weeks (Monday-first) for the given month,
 * padding with neighbour-month days so every row has exactly 7 cells.
 */
export function buildCalendarGrid(
  year: number,
  month: number,
  productsByDay: Map<number, CalendarProduct[]>,
): CalendarDayData[][] {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  // getDay(): 0=Sun … 6=Sat → convert to Mon-based: 0=Mon … 6=Sun
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const days: CalendarDayData[] = [];

  // Leading days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const date = new Date(year, month - 2, d);
    days.push({
      dayOfMonth: d,
      dateString: toDateString(date),
      isCurrentMonth: false,
      isToday: false,
      isWeekend: isWeekendDay(date),
      products: [],
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    days.push({
      dayOfMonth: d,
      dateString: toDateString(date),
      isCurrentMonth: true,
      isToday: date.getTime() === todayMidnight.getTime(),
      isWeekend: isWeekendDay(date),
      products: productsByDay.get(d) ?? [],
    });
  }

  // Trailing days from next month
  const trailing = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) {
    const date = new Date(year, month, d);
    days.push({
      dayOfMonth: d,
      dateString: toDateString(date),
      isCurrentMonth: false,
      isToday: false,
      isWeekend: isWeekendDay(date),
      products: [],
    });
  }

  // Split into weeks
  const weeks: CalendarDayData[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekendDay(date: Date): boolean {
  // Mon-based index: 5=Sat, 6=Sun
  return (date.getDay() + 6) % 7 >= 5;
}

export function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
}
