'use client';

import { useState } from 'react';
import { Product } from '@/types';

interface ProductDetailClientProps {
  product: Product;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const finalPrice = product.discountPercentage
    ? Number(product.price) * (1 - Number(product.discountPercentage) / 100)
    : Number(product.price);

  const savingsAmount = product.discountPercentage
    ? (Number(product.price) - finalPrice).toFixed(2)
    : null;

  const incrementQuantity = () => setQuantity(q => q + 1);
  const decrementQuantity = () => setQuantity(q => (q > 1 ? q - 1 : 1));

  // Parse features from description (split by bullet points or newlines)
  const features = product.description
    .split('\n')
    .filter(line => line.trim().length > 0)
    .slice(0, 5);

  // Parse notes from comma-separated format
  const notesList = product.notes
    ? product.notes
        .split(',')
        .map(note => note.trim())
        .filter(note => note.length > 0)
    : [];

  const isLowStock = product.stock > 0 && product.stock <= 5;
  const isSoldOut = product.stock === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-8 md:py-16">
      <div className="container-custom px-4">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {/* Left Column - Image Gallery */}
          <div className="flex flex-col gap-6">
            {/* Main Image */}
            {product.imageUrl && (
              <div className="relative group">
                <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 h-96 lg:h-[500px] flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain p-8 group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Badge Overlay */}
                  {product.discountPercentage && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                      -{Number(product.discountPercentage)}%
                    </div>
                  )}

                  {isLowStock && (
                    <div className="absolute top-4 left-4 bg-orange-500 text-white px-3 py-1 rounded-full font-semibold text-xs shadow-lg">
                      Limited Stock
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Product Information */}
          <div className="flex flex-col">
            {/* Badge Section */}
            <div className="mb-6">
              {isSoldOut ? (
                <span className="inline-block bg-gray-300 text-gray-700 px-4 py-2 rounded-full font-semibold text-sm">
                  Sold Out
                </span>
              ) : isLowStock ? (
                <span className="inline-block bg-orange-100 text-orange-700 px-4 py-2 rounded-full font-semibold text-sm">
                  Limited Availability
                </span>
              ) : (
                <span className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold text-sm">
                  In Stock
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-black mb-2 leading-tight">
              {product.name}
            </h1>

            {/* Rating / Meta Info */}
            <p className="text-gray-500 text-sm mb-6 font-medium">Sealed</p>

            {/* Price Section */}
            <div className="bg-gradient-to-r from-red-50 to-red-100/50 rounded-xl p-6 mb-8 border border-red-200">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-red-600">
                  €{finalPrice.toFixed(2)}
                </span>
                {product.discountPercentage && (
                  <div className="flex flex-col gap-1">
                    <span className="text-lg text-gray-400 line-through">
                      €{Number(product.price).toFixed(2)}
                    </span>
                    <span className="text-sm font-semibold text-red-600">
                      Save €{savingsAmount}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <p className="text-gray-700 leading-relaxed text-base">
                {product.description.split('\n')[0]}
              </p>
            </div>

            {/* Features/Notes List */}
            {(notesList.length > 0 || features.length > 1) && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-black uppercase tracking-wide mb-4">
                  {notesList.length > 0 ? 'Notes' : 'Key Features'}
                </h3>
                <ul className="space-y-3">
                  {notesList.length > 0
                    ? notesList.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="text-red-600 font-bold mt-1">•</span>
                          <span className="text-gray-700 text-sm leading-relaxed">
                            {note}
                          </span>
                        </li>
                      ))
                    : features.slice(1).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="text-red-600 font-bold mt-1">✓</span>
                          <span className="text-gray-700 text-sm leading-relaxed">
                            {feature.trim()}
                          </span>
                        </li>
                      ))}
                </ul>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-8 flex items-center gap-6">
              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Quantity
              </span>
              <div className="flex items-center border-2 border-gray-300 rounded-lg bg-white">
                <button
                  onClick={decrementQuantity}
                  disabled={isSoldOut}
                  className="px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  −
                </button>
                <span className="px-6 py-3 font-bold text-lg text-black min-w-16 text-center">
                  {quantity}
                </span>
                <button
                  onClick={incrementQuantity}
                  disabled={isSoldOut}
                  className="px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 flex flex-col">
              <a
                href={`https://wa.me/34689178762?text=Hola, estoy interesado en "${product.name}". ¿Podrían darme más información?`}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn btn-primary w-full text-center font-bold py-4 text-lg transition-all ${
                  isSoldOut ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl'
                }`}
              >
                💬 Contact on WhatsApp
              </a>

              <a
                href="mailto:sales@tcgiberia.com"
                className="btn btn-secondary w-full text-center font-bold py-4 text-lg transition-all"
              >
                📧 Email Us
              </a>
            </div>

            {/* Shipping Info */}
            <div className="mt-8 pt-8 border-t border-gray-200 space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚚</span>
                <span>
                  <strong>Fast EU Shipping:</strong> 2-3 business days
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">✓</span>
                <span>
                  <strong>Authentic:</strong> Certified and verified
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">💬</span>
                <span>
                  <strong>Support:</strong> 24/7 customer service
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Product Information */}
        {!isSoldOut && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 mb-16">
            <h2 className="text-2xl font-bold text-black mb-6">About This Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold text-red-600 mb-2">Sealed</h3>
                <p className="text-gray-600 text-sm">Premium quality sealed cards delivered directly from Japan</p>
              </div>
              <div>
                <h3 className="font-bold text-red-600 mb-2">Secure Packaging</h3>
                <p className="text-gray-600 text-sm">Professional protection with tracked shipping included</p>
              </div>
              <div>
                <h3 className="font-bold text-red-600 mb-2">Expert Support</h3>
                <p className="text-gray-600 text-sm">Get detailed information about card conditions and authenticity</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
