'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_PRICE_VARIANT_MARGINS,
  computeVariantPriceBreakdown,
  convertJpyToEur,
  type PriceVariantKey,
} from '@/lib/price-import/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productId: string, prices: Record<PriceVariantKey, number>) => Promise<void>;
  row: ModalRow | null;
  exchangeRate: number;
}

export interface ModalRow {
  importedName: string;
  jpyPrice: number;
  correspondingRightJpyPrice: number | null;
  matchedProductId: string;
  matchedProductName: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN_MIN = 10;
const MARGIN_MAX = 200;

const EUR_PRICE_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});
const JPY_PRICE_FORMATTER = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
});

const VARIANT_CONFIG: Array<{
  key: PriceVariantKey;
  label: string;
  badge: string;
}> = [
  { key: 'shrink', label: 'Con plástico', badge: 'SHRINK' },
  { key: 'noShrink', label: 'Sin plástico', badge: 'NO_SHRINK' },
  { key: 'b2b', label: 'B2B', badge: 'B2B' },
  { key: 'b2bNoShrink', label: 'B2B sin plástico', badge: 'B2B_NO_SHRINK' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function PriceUpdateModal({ isOpen, onClose, onConfirm, row, exchangeRate }: PriceUpdateModalProps) {
  const [selectedMargins, setSelectedMargins] = useState<Record<PriceVariantKey, number>>({
    ...DEFAULT_PRICE_VARIANT_MARGINS,
  });
  const [confirming, setConfirming] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset slider values when a new row is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedMargins({ ...DEFAULT_PRICE_VARIANT_MARGINS });
    }
  }, [isOpen, row]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, confirming, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current && !confirming) onClose();
    },
    [confirming, onClose]
  );

  const eurCost = row ? convertJpyToEur(row.jpyPrice, exchangeRate) : 0;
  const noShrinkOriginCost = row?.correspondingRightJpyPrice
    ? convertJpyToEur(row.correspondingRightJpyPrice, exchangeRate)
    : eurCost;
  const variantCosts = useMemo(
    () => ({
      shrink: eurCost,
      noShrink: noShrinkOriginCost,
      b2b: eurCost,
      b2bNoShrink: noShrinkOriginCost,
    }),
    [eurCost, noShrinkOriginCost]
  );
  const breakdowns = useMemo(
    () =>
      computeVariantPriceBreakdown(eurCost, selectedMargins, {
        noShrink: noShrinkOriginCost,
        b2bNoShrink: noShrinkOriginCost,
      }),
    [eurCost, noShrinkOriginCost, selectedMargins]
  );

  const handleConfirm = async () => {
    if (!row) return;
    setConfirming(true);
    try {
      await onConfirm(row.matchedProductId, {
        shrink: breakdowns.shrink.finalPrice,
        noShrink: breakdowns.noShrink.finalPrice,
        b2b: breakdowns.b2b.finalPrice,
        b2bNoShrink: breakdowns.b2bNoShrink.finalPrice,
      });
    } finally {
      setConfirming(false);
    }
  };

  const updateMargin = (variant: PriceVariantKey, value: number) => {
    setSelectedMargins((prev) => ({ ...prev, [variant]: value }));
  };

  if (!isOpen || !row) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Actualizar precio</h2>
          <button
            onClick={onClose}
            disabled={confirming}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-semibold leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Product info */}
        <div className="px-6 pt-5 pb-4 space-y-4">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Producto importado</span>
              <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{row.importedName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Producto en catálogo</span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%] truncate">{row.matchedProductName}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
              <span className="text-gray-500">Precio JPY</span>
              <span className="font-medium text-gray-800">{JPY_PRICE_FORMATTER.format(row.jpyPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Coste en EUR</span>
              <span className="font-medium text-blue-600">{EUR_PRICE_FORMATTER.format(eurCost)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VARIANT_CONFIG.map((variant) => {
              const variantKey = variant.key;
              const variantMargin = selectedMargins[variantKey];
              const variantBreakdown = breakdowns[variantKey];

              return (
                <div key={variantKey} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{variant.label}</p>
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{variant.badge}</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      +{variantMargin}%
                    </span>
                  </div>

                  <label htmlFor={`${variantKey}-margin-slider`} className="mb-1 block text-xs font-medium text-gray-700">
                    Margen de beneficio
                  </label>
                  <input
                    id={`${variantKey}-margin-slider`}
                    type="range"
                    min={MARGIN_MIN}
                    max={MARGIN_MAX}
                    step={1}
                    value={variantMargin}
                    onChange={(e) => updateMargin(variantKey, Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-600"
                  />

                  <div className="mt-3 rounded-lg bg-white border border-gray-200 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Precio final</span>
                      <span className="font-bold text-red-600">{EUR_PRICE_FORMATTER.format(variantBreakdown.finalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Coste</span>
                      <span>{EUR_PRICE_FORMATTER.format(variantCosts[variantKey])}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Margen</span>
                      <span>+{variantMargin}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Beneficio</span>
                      <span>{EUR_PRICE_FORMATTER.format(variantBreakdown.benefit)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={confirming}
            className="flex-1 btn btn-secondary text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 btn btn-primary text-sm relative"
          >
            {confirming ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Guardando…
              </span>
            ) : (
              'Confirmar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
