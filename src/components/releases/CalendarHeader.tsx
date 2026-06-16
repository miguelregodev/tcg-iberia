'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  year: number;
  month: number;
  currentYear: number;
  currentMonth: number;
}

export function CalendarHeader({ year, month, currentYear, currentMonth }: Props) {
  const router = useRouter();

  const isAtMin = year === currentYear && month === currentMonth;
  const maxDate = new Date(currentYear, currentMonth + 11, 1); // 12 months ahead
  const isAtMax = new Date(year, month - 1, 1) >= maxDate;

  const monthLabel = useMemo(
    () =>
      new Date(year, month - 1, 1).toLocaleDateString('es-ES', {
        month: 'long',
        year: 'numeric',
      }),
    [year, month],
  );

  function navigate(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    router.push(`/releases-calendar?month=${y}-${m}`);
  }

  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
      <button
        onClick={() => navigate(-1)}
        disabled={isAtMin}
        aria-label="Mes anterior"
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
      >
        <svg
          className="w-5 h-5 text-gray-700"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <h2 className="text-base sm:text-lg font-semibold text-gray-900 capitalize">
        {monthLabel}
      </h2>

      <button
        onClick={() => navigate(1)}
        disabled={isAtMax}
        aria-label="Mes siguiente"
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none"
      >
        <svg
          className="w-5 h-5 text-gray-700"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
