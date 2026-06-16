import type { CalendarDayData, CalendarProduct } from '@/types/releases';
import { CalendarDay } from './CalendarDay';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface Props {
  grid: CalendarDayData[][];
  onProductClick: (product: CalendarProduct) => void;
}

export function CalendarGrid({ grid, onProductClick }: Props) {
  return (
    <div role="grid" aria-label="Calendario de lanzamientos">
      {/* Day-of-week header row */}
      <div className="grid grid-cols-7 border-b border-gray-200" role="row">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            aria-label={label}
            className="py-2 sm:py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {grid.map((week, weekIndex) => (
        <div
          key={weekIndex}
          className="grid grid-cols-7 border-b border-gray-100 last:border-b-0"
          role="row"
        >
          {week.map((day) => (
            <CalendarDay key={day.dateString} day={day} onProductClick={onProductClick} />
          ))}
        </div>
      ))}
    </div>
  );
}
