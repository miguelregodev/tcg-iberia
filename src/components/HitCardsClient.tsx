'use client';

import { Product } from '@/types';

interface HitCardsClientProps {
  product: Product;
}

export function HitCardsClient({ product }: HitCardsClientProps) {
  const hitCards = product.hitCards || [];
  const hasHitCards = hitCards.length > 0;

  console.log(`Total hit cards loaded: ${hitCards.length}`, hitCards);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-8 md:py-16">
      <div className="container-custom px-4">
        {/* Header */}
        <div className="mb-12">
          <a
            href={`/product/${product.slug}`}
            className="text-red-600 font-semibold hover:text-red-700 inline-flex items-center gap-2 mb-6"
          >
            ← Back to {product.name}
          </a>

          <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
            Best Hit Cards
          </h1>
          <p className="text-lg text-gray-600">
            Explore the finest and rarest hit cards from {product.name}
          </p>
        </div>

        {!hasHitCards ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-xl text-gray-600 mb-4">
              No hit cards available for this product yet.
            </p>
            <p className="text-gray-500">
              Check back soon for the best hit cards and special editions.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {hitCards.map(card => (
              <HitCardComponent key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* Product Information Banner */}
        <div className="mt-16 bg-white rounded-xl border border-gray-200 p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-32 h-40 object-cover rounded-lg border border-gray-300"
              />
            )}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-black mb-2">
                {product.name}
              </h3>
              <p className="text-gray-600 mb-4">{product.description.split('\n')[0]}</p>
              <a
                href={`/product/${product.slug}`}
                className="inline-block bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-all"
              >
                View Product
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HitCardComponentProps {
  card: any;
}

function HitCardComponent({ card }: HitCardComponentProps) {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow duration-300">
      {/* Image Container */}
      <div className="relative overflow-hidden bg-gray-100 h-[600px]">
        <img
          src={card.imageUrl}
          alt={card.name}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-3 right-3">
          <span className="inline-block bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">
            {card.type}
          </span>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-6">
        <h3 className="text-xl font-bold text-black mb-3 line-clamp-2">
          {card.name}
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-gray-600">Market Price</span>
            <span className="text-2xl font-bold text-red-600">
              €{Number(card.marketPrice).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
