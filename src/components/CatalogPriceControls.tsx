'use client';

import { useId, useState } from 'react';
import {
  DEFAULT_PRICE_OPTIONS,
  type CatalogPriceBounds,
  type CatalogPriceOptions,
} from '@/lib/products/price-filter';

interface CatalogPriceControlsProps {
  options: CatalogPriceOptions;
  onChange: (options: CatalogPriceOptions) => void;
  resultCount: number;
  priceBounds: CatalogPriceBounds | null;
  loading?: boolean;
}

const FIELD_CLASS = 'w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold';
const BUTTON_CLASS = 'rounded-lg border border-dark-border px-3 py-2 text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold';

export function CatalogPriceControls({ options, onChange, resultCount, priceBounds, loading }: CatalogPriceControlsProps) {
  const id = useId();
  const [draft, setDraft] = useState<{ key: string; min: number; max: number } | null>(null);
  const lower = priceBounds?.min ?? 0;
  const upper = priceBounds?.max ?? 0;
  const rangeKey = `${lower}:${upper}:${options.minPrice}:${options.maxPrice}`;
  const clamp = (value: number) => Math.min(upper, Math.max(lower, value));
  const appliedMin = clamp(options.minPrice ?? lower);
  const appliedMax = Math.max(appliedMin, clamp(options.maxPrice ?? upper));
  const min = draft?.key === rangeKey ? draft.min : appliedMin;
  const max = draft?.key === rangeKey ? draft.max : appliedMax;
  const disabled = loading || !priceBounds || lower === upper;
  const span = upper - lower;
  const start = span > 0 ? ((min - lower) / span) * 100 : 0;
  const end = span > 0 ? ((max - lower) / span) * 100 : 100;
  const hasRange = options.minPrice != null || options.maxPrice != null;
  const hasSort = options.sort !== 'default';

  const commitRange = () => {
    if (disabled || draft?.key !== rangeKey) return;
    onChange({
      ...options,
      minPrice: min === lower ? null : min,
      maxPrice: max === upper ? null : max,
    });
    setDraft(null);
  };

  const clearRange = () => {
    setDraft(null);
    onChange({ ...options, minPrice: null, maxPrice: null });
  };

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-dark-border bg-dark-bgSecondary p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <fieldset className="min-w-0 flex-1">
          <legend className="mb-2 text-sm text-text-secondary">Filtrar por precio</legend>
          <div className="flex justify-between gap-4 text-sm text-text-primary">
            <label htmlFor={`${id}-min`}>Mínimo: {priceBounds && !loading ? `${min.toFixed(2)} €` : '—'}</label>
            <label htmlFor={`${id}-max`}>Máximo: {priceBounds && !loading ? `${max.toFixed(2)} €` : '—'}</label>
          </div>
          <div className="relative mx-3 h-11">
            <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-5 h-1 w-[calc(100%-1.5rem)] overflow-visible">
              <rect width="100%" height="4" rx="2" className="fill-dark-border" />
              <rect x={`${start}%`} width={`${end - start}%`} height="4" rx="2" className="fill-premium-gold" />
            </svg>
            {(['min', 'max'] as const).map((handle) => (
              <input
                key={handle}
                id={`${id}-${handle}`}
                type="range"
                min={lower}
                max={upper}
                step="0.01"
                value={handle === 'min' ? min : max}
                disabled={disabled}
                aria-label={handle === 'min' ? 'Precio mínimo' : 'Precio máximo'}
                aria-valuemin={handle === 'min' ? lower : min}
                aria-valuemax={handle === 'min' ? max : upper}
                aria-valuetext={`${(handle === 'min' ? min : max).toFixed(2)} €`}
                className={`catalog-price-range ${handle === 'min' && min === upper ? 'z-20' : handle === 'max' ? 'z-10' : 'z-0'}`}
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber;
                  setDraft({
                    key: rangeKey,
                    min: handle === 'min' ? Math.min(value, max) : min,
                    max: handle === 'max' ? Math.max(value, min) : max,
                  });
                }}
                onPointerUp={commitRange}
                onPointerCancel={() => setDraft(null)}
                onKeyUp={commitRange}
                onBlur={commitRange}
              />
            ))}
          </div>
          <p className="text-xs text-text-secondary">Desliza los controles para ajustar el precio.</p>
        </fieldset>
        <div className="w-full lg:ml-auto lg:w-60">
          <select
            id={`${id}-sort`}
            value={options.sort}
            className={FIELD_CLASS}
            onChange={(event) => {
              const sort = event.target.value;
              if (sort === 'default' || sort === 'price-asc' || sort === 'price-desc') {
                onChange({ ...options, sort });
              }
            }}
          >
            <option value="default">Orden predeterminado</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-sm text-text-secondary">
          {loading ? 'Cargando productos…' : `${resultCount} productos`}
          {hasRange && ` · Precio: ${options.minPrice != null ? `${options.minPrice.toFixed(2)} €` : 'sin mínimo'} – ${options.maxPrice != null ? `${options.maxPrice.toFixed(2)} €` : 'sin máximo'}`}
        </p>
        {hasRange && <button type="button" onClick={clearRange} className={BUTTON_CLASS}>Quitar filtro de precio</button>}
        {hasSort && <button type="button" className={BUTTON_CLASS} onClick={() => onChange({ ...options, sort: 'default' })}>Quitar orden por precio</button>}
        {hasRange && hasSort && (
          <button type="button" className={BUTTON_CLASS} onClick={() => {
            setDraft(null);
            onChange(DEFAULT_PRICE_OPTIONS);
          }}>Restablecer precio y orden</button>
        )}
      </div>
    </div>
  );
}
