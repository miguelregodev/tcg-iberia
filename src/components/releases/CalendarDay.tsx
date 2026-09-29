'use client';

import { useState } from 'react';
import type { CalendarDayData, CalendarProduct } from '@/types/releases';
import { ReleaseProductCard } from './ReleaseProductCard';

/** Maximum thumbnails shown before the overflow badge appears. */
const MAX_VISIBLE = 4;

interface Props {
  day: CalendarDayData;
  onProductClick: (product: CalendarProduct) => void;
}

function getThumbnailGridCols(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-3';
}

export function CalendarDay({ day, onProductClick }: Props) {
  const [showAll, setShowAll] = useState(false);

  const total = day.products.length;
  // When overflow is active and not expanded, hide the last slot for the badge.
  const overflowCount = total > MAX_VISIBLE && !showAll ? total - (MAX_VISIBLE - 1) : 0;
  const visibleProducts =
    overflowCount > 0 ? day.products.slice(0, MAX_VISIBLE - 1) : day.products;

  const gridCols = getThumbnailGridCols(
    overflowCount > 0 ? MAX_VISIBLE : visibleProducts.length,
  );

  const ariaLabel = [
    String(day.dayOfMonth),
    total > 0
      ? `${total} lanzamiento${total !== 1 ? 's' : ''}`
      : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      role="gridcell"
      aria-label={ariaLabel}
      className={[
        'relative border-r border-dark-border last:border-r-0',
        'p-1 sm:p-1.5 lg:p-2',
        'min-h-[80px] sm:min-h-[100px] lg:min-h-[120px]',
        day.isCurrentMonth ? 'bg-dark-surface' : 'bg-dark-bgSecondary/60',
        day.isToday ? 'ring-2 ring-inset ring-premium-gold' : '',
        day.isWeekend && day.isCurrentMonth ? 'bg-dark-surfaceHover/40' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Day number */}
      <span
        className={[
          'inline-flex items-center justify-center w-6 h-6 mb-1',
          'text-xs sm:text-sm font-semibold rounded-full leading-none',
          day.isToday
            ? 'bg-premium-gold text-dark-bg'
            : day.isCurrentMonth
            ? 'text-text-primary'
            : 'text-text-muted',
        ].join(' ')}
        aria-hidden="true"
      >
        {day.dayOfMonth}
      </span>

      {/* Product thumbnails */}
      {visibleProducts.length > 0 && (
        <div className={`grid ${gridCols} gap-0.5`}>
          {visibleProducts.map((product) => (
            <ReleaseProductCard
              key={product.id}
              product={product}
              onClick={() => onProductClick(product)}
            />
          ))}

          {overflowCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              aria-label={`Ver ${overflowCount} lanzamientos más`}
              className={[
                'aspect-square flex items-center justify-center',
                'text-xs font-semibold rounded',
                'bg-dark-surfaceHover hover:bg-dark-bgSecondary text-text-secondary',
                'transition-colors focus-visible:ring-2 focus-visible:ring-premium-gold focus-visible:outline-none',
              ].join(' ')}
            >
              +{overflowCount}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
