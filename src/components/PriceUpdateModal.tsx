'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeSellingPrice, convertJpyToEur } from '@/lib/price-import/currency';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (productId: string, finalPrice: number) => Promise<void>;
  row: ModalRow | null;
  exchangeRate: number;
}

export interface ModalRow {
  importedName: string;
  jpyPrice: number;
  matchedProductId: string;
  matchedProductName: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MARGIN_MIN = 10;
const MARGIN_DEFAULT = 25;
const MARGIN_MAX = 200;

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const jpy = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });

// ── Component ─────────────────────────────────────────────────────────────────

export function PriceUpdateModal({ isOpen, onClose, onConfirm, row, exchangeRate }: PriceUpdateModalProps) {
  const [margin, setMargin] = useState(MARGIN_DEFAULT);
  const [confirming, setConfirming] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset slider when a new row is opened
  useEffect(() => {
    if (isOpen) setMargin(MARGIN_DEFAULT);
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

  const handleConfirm = async () => {
    if (!row) return;
    setConfirming(true);
    try {
      await onConfirm(row.matchedProductId, finalPrice);
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen || !row) return null;

  const eurCost = convertJpyToEur(row.jpyPrice, exchangeRate);
  const finalPrice = computeSellingPrice(eurCost, margin);
  const marginLabel = `+${margin}%`;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-slideUp">
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
              <span className="font-medium text-gray-800">{jpy.format(row.jpyPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Coste en EUR</span>
              <span className="font-medium text-blue-600">{eur.format(eurCost)}</span>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="margin-slider" className="text-sm font-medium text-gray-700">
                Margen de beneficio
              </label>
              <span className="text-sm font-bold text-red-600">{marginLabel}</span>
            </div>

            <input
              id="margin-slider"
              type="range"
              min={MARGIN_MIN}
              max={MARGIN_MAX}
              step={1}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-red-600"
            />

            <div className="flex justify-between text-xs text-gray-400">
              <span>+{MARGIN_MIN}% ({eur.format(computeSellingPrice(eurCost, MARGIN_MIN))})</span>
              <span>+{MARGIN_MAX}% ({eur.format(computeSellingPrice(eurCost, MARGIN_MAX))})</span>
            </div>
          </div>

          {/* Final price callout */}
          <div className="rounded-xl border-2 border-red-100 bg-red-50 p-4">
            <p className="text-xs text-red-500 uppercase tracking-wide font-semibold mb-1">
              Precio final de venta
            </p>
            <p className="text-3xl font-bold text-red-600">{eur.format(finalPrice)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Coste {eur.format(eurCost)} · Margen {marginLabel} · Beneficio {eur.format(finalPrice - eurCost)}
            </p>
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
