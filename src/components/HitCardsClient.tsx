'use client';

import { useState } from 'react';
import { Product, HitCard } from '@/types';

interface HitCardsClientProps {
  product: Product;
}

const TYPE_COLORS: Record<string, string> = {
  default:
    'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-purple-700',
  ULTRA_RARE:
    'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-yellow-600',
  SECRET_RARE:
    'bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white border-fuchsia-700',
  RARE:
    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-700',
  HOLO:
    'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-600',
  PROMO:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-600',
};

const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

function getTypeStyle(type: string): string {
  const key = type.toUpperCase().replace(/\s+/g, '_');
  return TYPE_COLORS[key] ?? TYPE_COLORS.default;
}

export function HitCardsClient({ product }: HitCardsClientProps) {
  const hitCards = product.hitCards || [];
  const hasHitCards = hitCards.length > 0;
  const [lightbox, setLightbox] = useState<HitCard | null>(null);

  const totalValue = hitCards.reduce(
    (sum, c) => sum + Number(c.marketPrice),
    0,
  );
  const maxValue = hitCards.reduce(
    (max, c) => Math.max(max, Number(c.marketPrice)),
    0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Hero band */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-red-900 to-black text-white">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(220,38,38,0.4) 0%, transparent 60%)',
          }}
        />
        <div className="container-custom px-4 relative z-10 py-10 md:py-16">
          <a
            href={`/product/${product.slug}`}
            className="text-red-200 font-semibold hover:text-white inline-flex items-center gap-2 mb-6 text-sm transition-colors"
          >
            ← Volver a {product.name}
          </a>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <span className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider mb-3">
                Hit cards destacadas
              </span>
              <h1 className="font-airstrike text-3xl md:text-5xl lg:text-6xl uppercase tracking-wider leading-tight">
                Las mejores cartas
              </h1>
              <p className="mt-2 text-gray-300 text-base md:text-lg max-w-2xl">
                Explora las cartas más raras y codiciadas de{' '}
                <span className="text-white font-semibold">{product.name}</span>.
              </p>
            </div>

            {hasHitCards && (
              <div className="grid grid-cols-3 gap-3 md:gap-4 text-center">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-xs uppercase tracking-wide text-gray-300">
                    Cartas
                  </div>
                  <div className="text-2xl font-bold">{hitCards.length}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-xs uppercase tracking-wide text-gray-300">
                    Top
                  </div>
                  <div className="text-2xl font-bold">
                    {currency.format(maxValue)}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 min-w-[90px]">
                  <div className="text-xs uppercase tracking-wide text-gray-300">
                    Total
                  </div>
                  <div className="text-2xl font-bold">
                    {currency.format(totalValue)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container-custom px-4 py-10 md:py-14">
        {!hasHitCards ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">✨</div>
            <p className="text-xl font-semibold text-gray-900 mb-2">
              Aún no hay hit cards
            </p>
            <p className="text-gray-500">
              Vuelve pronto para descubrir las mejores cartas y ediciones
              especiales.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
            {hitCards.map((card) => (
              <HitCardComponent
                key={card.id}
                card={card}
                onOpen={() => setLightbox(card)}
              />
            ))}
          </div>
        )}

        {/* Product Information Banner */}
        <div className="mt-14 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-6 p-6 md:p-8">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-28 h-36 md:w-32 md:h-40 object-contain bg-gray-50 rounded-xl border border-gray-200 p-2"
              />
            )}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl md:text-2xl font-bold text-black mb-1">
                {product.name}
              </h3>
              <p className="text-gray-600 text-sm md:text-base mb-4 line-clamp-2">
                {product.description.split('\n')[0]}
              </p>
              <a
                href={`/product/${product.slug}`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-all hover:shadow-lg"
              >
                Ver producto
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 md:-top-4 md:-right-4 bg-white text-black rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-10"
              aria-label="Cerrar"
            >
              ✕
            </button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-br from-gray-900 to-black p-6 md:p-10 flex items-center justify-center">
                <img
                  src={lightbox.imageUrl}
                  alt={lightbox.name}
                  className="max-h-[70vh] w-auto rounded-lg shadow-xl"
                />
              </div>
              <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getTypeStyle(
                      lightbox.type,
                    )}`}
                  >
                    {lightbox.type}
                  </span>
                  <h3 className="text-xl md:text-2xl font-bold text-black mt-2">
                    {lightbox.name}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Precio de mercado
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-red-600">
                    {currency.format(Number(lightbox.marketPrice))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface HitCardComponentProps {
  card: HitCard;
  onOpen: () => void;
}

function HitCardComponent({ card, onOpen }: HitCardComponentProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-red-300 transition-all duration-300 flex flex-col"
    >
      {/* Image Container */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 aspect-[3/4]">
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-2 right-2">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-md ${getTypeStyle(
              card.type,
            )}`}
          >
            {card.type}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
          <span className="text-white text-xs font-semibold bg-white/15 backdrop-blur-sm border border-white/30 px-3 py-1 rounded-full">
            Ver detalle
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-3 flex-1 flex flex-col justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-red-600 transition-colors min-h-[2.5rem]">
          {card.name}
        </h3>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            Mercado
          </span>
          <span className="text-base font-bold text-red-600">
            {currency.format(Number(card.marketPrice))}
          </span>
        </div>
      </div>
    </button>
  );
}
