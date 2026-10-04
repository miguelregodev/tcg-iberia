'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { Product } from '@/types';
import { useCart } from '@/context/CartContext';
import { CompleteYourPurchase } from './CompleteYourPurchase';
import { FavoriteButton } from './FavoriteButton';
import { StockAlertButton } from './StockAlertButton';
import { trackPreorderViewed, trackProductViewed } from '@/lib/analytics/events';
import { formatReleaseDate, getProductInventoryState, getProductPurchaseLabel, getProductQuantityLimit, getProductStatusLabel } from '@/lib/products/state';
import { getEstimatedDeliveryRange } from '@/lib/shipping/delivery-estimate';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';

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
  const [addedToCart, setAddedToCart] = useState(false);
  const [variant, setVariant] = useState<'sealed' | 'live'>(
    product.liveOpeningPrice != null ? 'live' : 'sealed'
  );
  const { addToCart, items } = useCart();
  const { isB2B } = useB2BSession();
  const b2bOverrides = useB2BPrices(isB2B ? [product.id] : []);
  const b2bSealedPrice = isB2B ? (b2bOverrides.get(product.id)?.b2bPrice ?? null) : null;
  const flagInfo = getLanguageFlag(product.language);
  const releaseDate = formatReleaseDate(product.releaseDate);
  const estimatedDeliveryRange = getEstimatedDeliveryRange();
  

  const hasLiveOpening = product.liveOpeningPrice != null;

  // Build the effective product object for the current variant.
  // The live-opening variant gets a virtual ID (suffix) so it lives as a
  // separate cart line item — independent quantity, independent price.
  // Both variants share the same stock pool.
  const variantProduct = hasLiveOpening && variant === 'live'
    ? { ...product, id: `${product.id}_live`, price: Number(product.liveOpeningPrice!), discountPercentage: null }
    : product;

  // Derive inventory state from the active variant's stock so all stock
  // validation (button disabled, quantity limits, low-stock badge) reflects
  // the correct variant.
  const inventoryState = getProductInventoryState({
    stock: variantProduct.stock,
    releaseDate: product.releaseDate,
  });

  // Active price depends on variant selection; B2B overrides take priority
  const activeBasePrice = variant === 'sealed' && b2bSealedPrice
    ? b2bSealedPrice
    : variantProduct.price;
  // No discount for B2B users
  const activeDiscount = isB2B ? null : variantProduct.discountPercentage;

  // Sellado and Apertura en Directo share one stock pool, so both cart lines
  // (base id and `_live` suffixed id) count against the same limit.
  const inCartQuantity = items
    .filter((it) => it.product.id === product.id || it.product.id === `${product.id}_live`)
    .reduce((sum, it) => sum + it.quantity, 0);
  const quantityLimit = getProductQuantityLimit(inventoryState);
  const maxAddable = quantityLimit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, quantityLimit - inCartQuantity);
  const reachedMax = quantityLimit !== null && quantity >= maxAddable;

  const addToCartDisabled =
    isB2B ||
    !inventoryState.canPurchase ||
    (quantityLimit !== null && maxAddable === 0);

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

  const finalPrice = activeDiscount
    ? activeBasePrice * (1 - Number(activeDiscount) / 100)
    : activeBasePrice;

  const savingsAmount = activeDiscount
    ? (activeBasePrice - finalPrice).toFixed(2)
    : null;

  const incrementQuantity = () =>
    setQuantity((q) => (q < maxAddable ? q + 1 : q));
  const decrementQuantity = () => setQuantity((q) => (q > 1 ? q - 1 : 1));

  const handleAddToCart = () => {
    if (!inventoryState.canPurchase) return;
    const safeQty = quantityLimit === null ? quantity : Math.min(quantity, maxAddable);
    addToCart(variantProduct, safeQty);
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

  // StockAlertButton is for the base (sealed) product — don't show it for
  // the live-opening variant when it runs out; instead show a disabled add-to-cart.
  const isSoldOut = variant === 'sealed' && inventoryState.isOutOfStock;
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
    <div className="min-h-screen bg-dark-bg py-8 md:py-16">
      <div className="container-custom px-4">
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {/* Left Column - Image Gallery */}
          <div className="flex flex-col gap-6">
            {/* Main Image */}
            {product.imageUrl && (
              <div className="relative group">
                <div className="relative bg-dark-surface rounded-2xl shadow-elevated overflow-hidden border border-dark-border h-96 lg:h-[500px] flex items-center justify-center">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain p-8 group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Language Flag */}
                  <div className="absolute top-4 left-4 bg-dark-surface/90 backdrop-blur rounded-lg p-2 shadow-elevated border border-dark-border">
                    <img
                      src={flagInfo.path}
                      alt={flagInfo.name}
                      title={flagInfo.name}
                      className="w-8 h-5 object-cover rounded"
                    />
                  </div>

                  {/* Badge Overlay */}
                  {product.discountPercentage && (
                    <div className="absolute top-4 right-4 bg-premium-gold text-dark-bg px-4 py-2 rounded-full font-bold text-sm shadow-elevated">
                      -{Number(product.discountPercentage)}%
                    </div>
                  )}

                  {inventoryState.isLowStock && !isB2B && (
                    <div className="absolute bottom-4 right-4 bg-warning text-dark-bg px-3 py-1 rounded-full font-semibold text-xs shadow-elevated">
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
                  ? 'bg-premium-gold/15 text-premium-gold'
                  : inventoryState.status === 'available'
                  ? 'bg-success-bg text-success'
                  : inventoryState.status === 'low_stock'
                  ? 'bg-warning-bg text-warning'
                  : 'bg-danger-bg text-danger'
              }`}>
                {isB2B
                  ? inventoryState.status === 'preorder'
                    ? getProductStatusLabel(inventoryState)
                    : 'Disponible'
                  : getProductStatusLabel(inventoryState)}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-text-primary mb-2 leading-tight">
              {product.name}
            </h1>

            {inventoryState.isPreorder && releaseDate ? (
              <p className="text-sm font-semibold text-premium-gold mb-4">
                Lanzamiento: {releaseDate}
              </p>
            ) : null}

            <br></br>

            {/* Variant selector — only when product has a live-opening price */}
            {hasLiveOpening && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                  Formato
                </p>
                <div className="inline-flex rounded-xl border border-dark-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setVariant('sealed')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      variant === 'sealed'
                        ? 'bg-premium-gold text-dark-bg'
                        : 'bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover'
                    }`}
                  >
                    Sellado — {(b2bSealedPrice ?? Number(product.price)).toFixed(2)}€
                    {b2bSealedPrice && <span className="ml-1 text-[10px] font-bold bg-dark-bg/20 text-dark-bg px-1 rounded">B2B</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariant('live')}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-l border-dark-border ${
                      variant === 'live'
                        ? 'bg-premium-gold text-dark-bg'
                        : 'bg-dark-surface text-text-secondary hover:bg-dark-surfaceHover'
                    }`}
                  >
                    Apertura en Directo — {Number(product.liveOpeningPrice).toFixed(2)}€
                  </button>
                </div>

                {/* Live-opening warning — only shown when this variant is selected */}
                {variant === 'live' && (
                  <div
                    role="alert"
                    className="mt-3 rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-warning space-y-2"
                  >
                    <p className="font-bold">⚠️ Este producto se abrirá en directo</p>
                    <p>
                      Al seleccionar &quot;Apertura en Directo&quot;, aceptas que el producto se abrirá
                      durante el LIVE de TikTok o Twitch en curso si hay uno activo, o durante el próximo LIVE si
                      no hay ninguno en curso en este momento.
                    </p>
                    <p>
                      Los productos seleccionados como &quot;Apertura en Directo&quot; nunca se envían
                      precintados.
                    </p>
                    <p>
                      Si no quieres que tu producto se abra en directo, selecciona &quot;Sellado&quot;.
                    </p>
                    <p>
                      <Link
                        href="/politica-apertura-en-directo"
                        className="font-semibold underline hover:text-premium-gold transition-colors"
                      >
                        Consulta las condiciones de &quot;Apertura en Directo&quot;
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Price Section */}
              <div className="flex items-baseline gap-4">
                <span className="text-xl font-bold text-premium-gold">
                  {finalPrice.toFixed(2)}€
                </span>
                {activeDiscount && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-text-muted line-through">
                      {activeBasePrice.toFixed(2)}€
                    </span>
                    <span className="text-[11px] font-semibold text-danger">
                      Ahorras {savingsAmount}€
                    </span>
                  </div>
                )}
                {isB2B && b2bSealedPrice && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-premium-gold/15 text-premium-gold">
                    Precio B2B
                  </span>
                )}
              </div>

            {/* Description */}
            <div className="mb-8">
              <p className="text-text-secondary leading-relaxed text-base">
                {product.description.split('\n')[0]}
              </p>
            </div>

            {/* Features/Notes List */}
            {(notesList.length > 0 || features.length > 1) && (
              <div className="mb-8">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide mb-4">
                  {notesList.length > 0 ? 'Detalles' : 'Key Features'}
                </h3>
                <div className="space-y-3">
                  {notesList.length > 0
                    ? notesList.map((note, idx) => (
                        <p key={idx} className="text-text-secondary text-sm leading-relaxed">
                          {note}
                        </p>
                      ))
                    : features.slice(1).map((feature, idx) => (
                        <p key={idx} className="text-text-secondary text-sm leading-relaxed">
                          {feature.trim()}
                        </p>
                      ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                Unidades
              </span>
              <div className="flex items-center border-2 border-dark-border rounded-lg bg-dark-surface">
                <button
                  type="button"
                  onClick={decrementQuantity}
                  disabled={!inventoryState.canPurchase || quantity <= 1}
                  aria-label="Reducir cantidad"
                  className="px-4 py-3 text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                >
                  −
                </button>
                <span className="px-6 py-3 font-bold text-lg text-text-primary min-w-16 text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={incrementQuantity}
                  disabled={!inventoryState.canPurchase || reachedMax}
                  aria-label="Aumentar cantidad"
                  className="px-4 py-3 text-text-secondary hover:text-premium-gold hover:bg-dark-surfaceHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
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
                  className="btn bg-dark-surfaceHover border border-premium-gold/30 text-premium-gold w-full text-center font-bold py-4 text-lg transition-all hover:bg-dark-surface"
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
                    <div className="relative flex-1 group">
                      <button
                        onClick={handleAddToCart}
                        disabled={addToCartDisabled}
                        className={`btn w-full text-center font-bold py-4 text-lg transition-all flex items-center justify-center gap-2 ${
                          addToCartDisabled
                            ? 'bg-dark-surfaceHover text-text-muted cursor-not-allowed'
                            : addedToCart
                              ? 'bg-success text-dark-bg'
                              : 'btn-primary'
                        }`}
                      >
                        <img
                          src="/images/add-to-cart.png"
                          alt="Add to Cart"
                          className={`w-5 h-5 ${addToCartDisabled || addedToCart ? 'icon-invert' : ''}`}
                        />
                        {addedToCart
                          ? '✓ Añadido al carrito'
                          : getProductPurchaseLabel(inventoryState)}
                      </button>

                      {isB2B && (
                        <div
                          className="
                            pointer-events-none
                            absolute
                            left-1/2
                            top-full
                            z-50
                            mt-2
                            w-72
                            -translate-x-1/2
                            rounded-lg
                            bg-dark-surface
                            border
                            border-dark-border
                            px-4
                            py-3
                            text-sm
                            text-text-primary
                            opacity-0
                            shadow-elevated
                            transition-opacity
                            duration-200
                            group-hover:opacity-100
                          "
                        >
                          Para realizar compras como cliente B2B debes acceder al
                          <span className="font-semibold"> catálogo B2B</span>. Si deseas comprar
                          como cliente particular, primero cierra tu sesión B2B.
                        </div>
                      )}
                    </div>
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
            <div className="mt-8 pt-8 border-t border-dark-border space-y-3 text-sm text-text-secondary">
              <div className="flex items-center gap-3">
                <span className="text-lg">🚚</span>
                <span>
                  <strong>Entrega el {estimatedDeliveryRange}</strong>, excepto si eliges{' '}
                  <Link
                    href="/envio-agrupado"
                    className="text-premium-gold underline-offset-4 hover:underline"
                  >
                    envío agrupado
                  </Link>
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
