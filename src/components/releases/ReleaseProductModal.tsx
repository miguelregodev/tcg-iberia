'use client';

import { useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { CalendarProduct } from '@/types/releases';

const LANGUAGE_LABELS: Record<string, string> = {
  JAPANESE: 'Japonés',
  KOREAN: 'Coreano',
  ENGLISH: 'Inglés',
  SPANISH: 'Español',
};

const LANGUAGE_FLAGS: Record<string, string> = {
  JAPANESE: '/images/japan.png',
  KOREAN: '/images/south-korea.png',
  ENGLISH: '/images/united-kingdom.png',
  SPANISH: '/images/spain.png',
};

interface Props {
  product: CalendarProduct;
  onClose: () => void;
}

export function ReleaseProductModal({ product, onClose }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const releaseFormatted = new Date(product.releaseDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const flagSrc = LANGUAGE_FLAGS[product.language] ?? LANGUAGE_FLAGS.ENGLISH;
  const languageLabel = LANGUAGE_LABELS[product.language] ?? product.language;

  return (
    /* Outer layer catches backdrop clicks */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalles de ${product.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        aria-hidden="true"
      />

      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Product image */}
        <div className="h-64 sm:h-80 bg-gray-100 overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg
                className="w-12 h-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-5">
          <h3 className="text-xl font-bold text-gray-900 mb-4 leading-snug">
            {product.name}
          </h3>

          <dl className="space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-500">Precio</dt>
              <dd className="flex items-center gap-2">
                {product.discountPercentage ? (
                  <>
                    <span className="text-base font-semibold text-red-600">
                      {(product.price * (1 - product.discountPercentage / 100)).toFixed(2)}€
                    </span>
                    <span className="text-sm text-gray-400 line-through">
                      {product.price.toFixed(2)}€
                    </span>
                  </>
                ) : (
                  <span className="text-base font-semibold text-red-600">
                    {product.price.toFixed(2)}€
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-500">Lanzamiento</dt>
              <dd className="text-sm font-medium text-gray-800 capitalize">
                {releaseFormatted}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-500">Idioma</dt>
              <dd className="flex items-center gap-1.5">
                <img
                  src={flagSrc}
                  alt={languageLabel}
                  className="w-5 h-3.5 object-cover rounded-sm"
                />
                <span className="text-sm font-medium text-gray-800">{languageLabel}</span>
              </dd>
            </div>
          </dl>

          <div className="flex gap-3">
            <Link
              href={`/product/${product.slug}`}
              className="flex-1 btn btn-primary text-center text-sm"
              onClick={onClose}
            >
              Ver producto
            </Link>
          </div>
        </div>

        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className={[
            'absolute top-3 right-3 p-1.5 rounded-full',
            'bg-white/80 hover:bg-white',
            'text-gray-500 hover:text-gray-900 shadow',
            'transition-colors focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none',
          ].join(' ')}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
