'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { CompleteYourPurchase } from './CompleteYourPurchase';
import { FavoriteButton } from './FavoriteButton';
import { StockAlertButton } from './StockAlertButton';
import { trackPreorderViewed, trackProductViewed } from '@/lib/analytics/events';
import { formatReleaseDate, getProductInventoryState, getProductPurchaseLabel, getProductQuantityLimit, getProductStatusLabel } from '@/lib/products/state';

interface ProductDetailClientProps {
  product: Product;
}

function getLanguageFlag(language: string): { path: string; name: string } {
  const flags: Record<string, { path: string; name: string }> = {
    ENGLISH: { path: '/images/united-kingdom.png', name: 'English' },
    JAPANESE: { path: '/images/japan.png', name: 'Japanese' },
    KOREAN: { path: '/images/south-korea.png', name: 'Korean' },
    SPANISH: { path: '/images/spain.png', name: 'Spanish' },
  };
  return flags[language] || flags.ENGLISH;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const { addToCart, items } = useCart();
  const flagInfo = getLanguageFlag(product.language);
  const inventoryState = getProductInventoryState({
    stock: product.stock,
    releaseDate: product.releaseDate,
  });
  const releaseDate = formatReleaseDate(product.releaseDate);

  // How many of this product are already in the cart.
  const inCartQuantity =
    items.find((it) => it.product.id === product.id)?.quantity ?? 0;
  const quantityLimit = getProductQuantityLimit(inventoryState);
  const maxAddable = quantityLimit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, quantityLimit - inCartQuantity);
  const reachedMax = quantityLimit !== null && quantity >= maxAddable;

  // Clamp the selected quantity if cart contents change and shrink the limit.
  useEffect(() => {
    if (quantityLimit !== null && maxAddable === 0) {
      if (quantity !== 1) setQuantity(1);
      return;
    }
    if (quantityLimit !== null && quantity > maxAddable) {
      setQuantity(maxAddable);
    }
  }, [maxAddable, quantity, quantityLimit]);

  const finalPrice = product.discountPercentage
    ? Number(product.price) * (1 - Number(product.discountPercentage) / 100)
    : Number(product.price);

  const savingsAmount = product.discountPercentage
    ? (Number(product.price) - finalPrice).toFixed(2)
    : null;

  const incrementQuantity = () =>
    setQuantity((q) => (q < maxAddable ? q + 1 : q));
  const decrementQuantity = () => setQuantity((q) => (q > 1 ? q - 1 : 1));

  const handleAddToCart = () => {
    if (!inventoryState.canPurchase) return;
    const safeQty = quantityLimit === null ? quantity : Math.min(quantity, maxAddable);
    addToCart(product, safeQty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

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

  const isSoldOut = inventoryState.isOutOfStock;
  const hasHitCards = product.hitCards && product.hitCards.length > 0;

  useEffect(() => {
    trackProductViewed({
      productId: product.id,
      productName: product.name,
      category: product.type ?? 'unknown',
      price: Number(product.price),
      releaseDate: product.releaseDate ?? undefined,
    });
  }, [product.id, product.name, product.type, product.price, product.releaseDate]);

  useEffect(() => {
    if (!inventoryState.isPreorder || !product.releaseDate) return;

    try {
      trackPreorderViewed({
        productId: product.id,
        productName: product.name,
        releaseDate: product.releaseDate,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { module: 'product-detail', action: 'track-preorder-viewed' },
        extra: { productId: product.id },
      });
    }
  }, [inventoryState.isPreorder, product.id, product.name, product.releaseDate]);

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

                  {/* Language Flag */}
                  <div className="absolute top-4 left-4 bg-white rounded-lg p-2 shadow-md">
                    <img
                      src={flagInfo.path}
                      alt={flagInfo.name}
                      title={flagInfo.name}
                      className="w-8 h-5 object-cover rounded"
                    />
                  </div>

                  {/* Badge Overlay */}
                  {product.discountPercentage && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                      -{Number(product.discountPercentage)}%
                    </div>
                  )}

                  {inventoryState.isLowStock && (
                    <div className="absolute bottom-4 right-4 bg-orange-500 text-white px-3 py-1 rounded-full font-semibold text-xs shadow-lg">
                      Últimas unidades
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
              <span className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${
                inventoryState.status === 'preorder'
                  ? 'bg-blue-100 text-blue-700'
                  : inventoryState.status === 'available'
                  ? 'bg-green-100 text-green-700'
                  : inventoryState.status === 'low_stock'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-300 text-gray-700'
              }`}>
                {getProductStatusLabel(inventoryState)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-black mb-2 leading-tight">
              {product.name}
            </h1>

            {inventoryState.isPreorder && releaseDate ? (
              <p className="text-sm font-semibold text-blue-700 mb-4">
                Lanzamiento: {releaseDate}
              </p>
            ) : null}

            <br></br>


            {/* Price Section */}
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-black-600">
                  {finalPrice.toFixed(2)}€
                </span>
                {product.discountPercentage && (
                  <div className="flex flex-col gap-1">
                    <span className="text-lg text-gray-400 line-through">
                      {Number(product.price).toFixed(2)}€
                    </span>
                    <span className="text-sm font-semibold text-red-600">
                      Ahorras {savingsAmount}€
                    </span>
                  </div>
                )}
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
                  {notesList.length > 0 ? 'Detalles' : 'Key Features'}
                </h3>
                <div className="space-y-3">
                  {notesList.length > 0
                    ? notesList.map((note, idx) => (
                        <p key={idx} className="text-gray-700 text-sm leading-relaxed">
                          {note}
                        </p>
                      ))
                    : features.slice(1).map((feature, idx) => (
                        <p key={idx} className="text-gray-700 text-sm leading-relaxed">
                          {feature.trim()}
                        </p>
                      ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Unidades
              </span>
              <div className="flex items-center border-2 border-gray-300 rounded-lg bg-white">
                <button
                  type="button"
                  onClick={decrementQuantity}
                  disabled={!inventoryState.canPurchase || quantity <= 1}
                  aria-label="Reducir cantidad"
                  className="px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  −
                </button>
                <span className="px-6 py-3 font-bold text-lg text-black min-w-16 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={incrementQuantity}
                  disabled={!inventoryState.canPurchase || reachedMax}
                  aria-label="Aumentar cantidad"
                  className="px-4 py-3 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 flex flex-col">
              {hasHitCards && (
                <a
                  href={`/product/${product.slug}/hit-cards`}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white w-full text-center font-bold py-4 text-lg transition-all hover:shadow-xl"
                >
                  ✨ Ver hits ({product.hitCards?.length || 0})
                </a>
              )}

              <div className="flex items-stretch gap-3">
                {isSoldOut ? (
                  <StockAlertButton
                    productId={product.id}
                    productName={product.name}
                    productCategory={product.type ?? undefined}
                    productPrice={finalPrice}
                    className="flex-1"
                  />
                ) : (
                  <button
                    onClick={handleAddToCart}
                    disabled={!inventoryState.canPurchase || (quantityLimit !== null && maxAddable === 0)}
                    className={`btn flex-1 text-center font-bold py-4 text-lg transition-all hover:shadow-xl flex items-center justify-center gap-2 ${
                      !inventoryState.canPurchase || (quantityLimit !== null && maxAddable === 0)
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : addedToCart
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <img
                      src="/images/add-to-cart.png"
                      alt="Add to Cart"
                      className="w-5 h-5"
                    />
                    {addedToCart
                      ? '\u2713 A\u00f1adido al carrito'
                      : getProductPurchaseLabel(inventoryState)}
                  </button>
                )}

                <FavoriteButton
                  productId={product.id}
                  productName={product.name}
                  productCategory={product.type ?? undefined}
                  productPrice={finalPrice}
                  className="w-14 h-auto"
                />
              </div>
            </div>

            {/* Shipping Info */}
            <div className="mt-8 pt-8 border-t border-gray-200 space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚚</span>
                <span>
                  <strong>Envío rápido</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">✓</span>
                <span>
                  <strong>Producto original</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">💬</span>
                <span>
                  <strong>Contáctanos para cualquier consulta o ayuda con tu pedido</strong> 
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested products carousel */}
        <CompleteYourPurchase excludeId={product.id} />

      </div>
    </div>
  );
}
