'use client';

import { useState } from 'react';
import type { CalendarDayData, CalendarProduct } from '@/types/releases';
import { CalendarHeader } from './CalendarHeader';
import { CalendarGrid } from './CalendarGrid';
import { ReleaseProductModal } from './ReleaseProductModal';

interface Props {
  calendarGrid: CalendarDayData[][];
  year: number;
  month: number;
  currentYear: number;
  currentMonth: number;
}

export function ReleasesCalendar({
  calendarGrid,
  year,
  month,
  currentYear,
  currentMonth,
}: Props) {
  const [selectedProduct, setSelectedProduct] = useState<CalendarProduct | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <CalendarHeader
        year={year}
        month={month}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />
      <CalendarGrid grid={calendarGrid} onProductClick={setSelectedProduct} />
      {selectedProduct && (
        <ReleaseProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
