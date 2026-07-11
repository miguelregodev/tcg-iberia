'use client';

import { useCart } from '@/context/CartContext';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FreeShippingProgress } from './FreeShippingProgress';
import { getFreeShippingState } from '@/lib/shipping/free-shipping';
import { formatReleaseDate, getProductInventoryState, getProductQuantityLimit, getProductStatusLabel } from '@/lib/products/state';
import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices } from '@/hooks/useB2BPrices';
import { B2B_IVA_RATE } from '@/lib/b2b/company';

interface ShoppingCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShoppingCartModal({ isOpen, onClose }: ShoppingCartModalProps) {
  const router = useRouter();
  const { items, totalPrice, shippingCost, finalPrice, removeFromCart, updateQuantity, clearCart } = useCart();
  const { isB2B, customer } = useB2BSession();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSubmittingB2B, setIsSubmittingB2B] = useState(false);
  const [b2bNotes, setB2bNotes] = useState('');
  const [b2bSuccess, setB2bSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);

  // ── B2B pricing overrides ─────────────────────────────────────────────────
  // Strip the `_noshrink` suffix so we look up overrides by the real product ID.
  const productIds = useMemo(
    () => items.map((i) => i.product.id.replace(/_noshrink$/, '')),
    [items]
  );
  const b2bOverrides = useB2BPrices(isB2B ? productIds : []);

  /** Compute the effective unit price for a cart line under the active session. */
  const effectiveUnitPrice = (item: (typeof items)[number]): number => {
    if (!isB2B) {
      return item.product.discountPercentage
        ? Number(item.product.price) * (1 - Number(item.product.discountPercentage) / 100)
        : Number(item.product.price);
    }
    const isNoShrink = item.product.id.endsWith('_noshrink');
    const realId = item.product.id.replace(/_noshrink$/, '');
    const override = b2bOverrides.get(realId);
    if (isNoShrink) {
      const wholesale = override?.b2bPriceNoShrink;
      return wholesale && wholesale > 0 ? wholesale : Number(item.product.price);
    }
    const wholesale = override?.b2bPrice;
    return wholesale && wholesale > 0 ? wholesale : Number(item.product.price);
  };

  /**
   * B2B totals.
   *
   * The wholesale prices shown per line are treated as VAT-inclusive
   * (the customer pays the sum of line prices as-is). The invoice split
   * therefore back-computes the pre-tax base:
   *   base_imponible = gross / 1.21
   *   IVA (21%)      = gross - base_imponible
   *   Total          = gross
   */
  const b2bGross = useMemo(() => {
    if (!isB2B) return 0;
    const total = items.reduce((sum, i) => sum + effectiveUnitPrice(i) * i.quantity, 0);
    return Math.round(total * 100) / 100;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isB2B, b2bOverrides]);
  const b2bSubtotal = useMemo(
    () => (isB2B ? Math.round((b2bGross / (1 + B2B_IVA_RATE)) * 100) / 100 : 0),
    [b2bGross, isB2B]
  );
  const b2bIva = useMemo(
    () => (isB2B ? Math.round((b2bGross - b2bSubtotal) * 100) / 100 : 0),
    [b2bGross, b2bSubtotal, isB2B]
  );
  const b2bTotal = b2bGross;

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setError(null);

    try {
      // Redirect to checkout page with customer data form
      router.push('/checkout');
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Checkout error';

      setError(errorMessage);
      setIsCheckingOut(false);
    }
  };

  const handleB2bSubmit = async () => {
    if (items.length === 0) return;
    setIsSubmittingB2B(true);
    setError(null);
    setB2bSuccess(null);

    // Build payload from cart lines — the API re-fetches prices/stock
    // server-side, so we only need to send ids + variants + quantities.
    const payload = items.map((i) => {
      const isNoShrink = i.product.id.endsWith('_noshrink');
      return {
        productId: i.product.id.replace(/_noshrink$/, ''),
        variant: (isNoShrink ? 'NO_SHRINK' : 'SHRINK') as 'SHRINK' | 'NO_SHRINK',
        quantity: i.quantity,
      };
    });

    try {
      const res = await fetch('/api/b2b/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items: payload, notes: b2bNotes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo registrar la solicitud.');
        return;
      }
      setB2bSuccess(
        `Solicitud enviada. Nº ${data.order?.orderNumber ?? ''}. Recibirás la factura por email en cuanto aprobemos el pedido.`
      );
      clearCart();
    } catch {
      setError('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setIsSubmittingB2B(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Tu Bolsa
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm font-semibold">Error: {error}</p>
              </div>
            )}

            {items.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg mb-4">El carrito está vacío</p>
                <button
                  onClick={onClose}
                  className="text-red-600 hover:text-red-700 font-semibold"
                >
                  Continuar Comprando
                </button>
              </div>
            ) : (
              <>
                <FreeShippingProgress
                  state={freeShippingState}
                  context="mini_cart"
                  className="mb-6"
                />

                {/* Items List */}
                <div className="space-y-4 mb-6">
                  {items.map(item => {
                    const finalUnitPrice = effectiveUnitPrice(item);
                    const itemTotal = finalUnitPrice * item.quantity;
                    const inventoryState = getProductInventoryState({
                      stock: item.product.stock,
                      releaseDate: item.product.releaseDate,
                    });
                    const releaseDate = formatReleaseDate(item.product.releaseDate);
                    const quantityLimit = getProductQuantityLimit(inventoryState);
                    const atMax = quantityLimit !== null && item.quantity >= quantityLimit;

                    return (
                      <div
                        key={item.product.id}
                        className="flex gap-4 items-start border border-gray-200 rounded-lg p-4"
                      >
                        {/* Product Image */}
                        {item.product.imageUrl && (
                          <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              className="w-full h-full object-contain p-2"
                            />
                          </div>
                        )}

                        {/* Product Details */}
                        <div className="flex-grow min-w-0">
                          <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">
                            {item.product.name}
                          </h3>
                          {/* Variant badge */}
                          {(item.product.id.endsWith('_noshrink') || item.product.noShrinkPrice != null) && (
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${
                              item.product.id.endsWith('_noshrink')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.product.id.endsWith('_noshrink') ? 'Sin Plástico' : 'Con Plástico'}
                            </span>
                          )}
                          <p className={`text-xs font-semibold mb-1 ${
                            inventoryState.isPreorder ? 'text-blue-700' : 'text-gray-600'
                          }`}>
                            {isB2B
                              ? inventoryState.isPreorder
                                ? getProductStatusLabel(inventoryState)
                                : 'Disponible'
                              : getProductStatusLabel(inventoryState)}
                          </p>
                          {inventoryState.isPreorder && releaseDate ? (
                            <p className="text-xs text-gray-500 mb-1">
                              Lanzamiento: {releaseDate}
                            </p>
                          ) : null}
                          <p className="text-sm text-gray-600 mb-2">
                            {finalUnitPrice.toFixed(2)}€ / ud
                            {isB2B && (
                              <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-red-100 text-red-700">
                                B2B
                              </span>
                            )}
                          </p>
                          {!isB2B && item.product.discountPercentage && (
                            <p className="text-xs text-red-600 font-semibold mb-2">
                              -{item.product.discountPercentage}% discount applied
                            </p>
                          )}

                          {/* Quantity Selector */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity - 1
                                )
                              }
                              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                            >
                              −
                            </button>
                            <span className="px-4 py-1 font-semibold text-gray-900 min-w-12 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity + 1
                                )
                              }
                              disabled={atMax}
                              aria-label="Aumentar cantidad"
                              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Price and Remove */}
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-gray-900 mb-3">
                            {itemTotal.toFixed(2)}€
                          </p>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-600 hover:text-red-700 text-sm font-semibold transition-colors"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="border-t border-gray-200 pt-6">
                  {isB2B ? (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-700 uppercase tracking-wide mb-3">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                          Solicitud mayorista B2B
                          {customer?.companyName && (
                            <span className="ml-1 text-gray-500 normal-case font-medium">
                              · {customer.companyName}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-700">Base imponible:</span>
                          <span className="font-semibold text-gray-900">
                            {b2bSubtotal.toFixed(2)}€
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-700">IVA (21%):</span>
                          <span className="font-semibold text-gray-900">
                            {b2bIva.toFixed(2)}€
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900">Total:</span>
                          <span className="text-lg font-bold text-red-600">
                            {b2bTotal.toFixed(2)}€
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          El envío se calcula por separado en la factura. El pedido se
                          preparará una vez la factura haya sido abonada.
                        </p>
                      </div>

                      {b2bSuccess ? (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                          {b2bSuccess}
                        </div>
                      ) : (
                        <>
                          <label
                            htmlFor="b2b-notes"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Notas para el equipo comercial (opcional)
                          </label>
                          <textarea
                            id="b2b-notes"
                            value={b2bNotes}
                            onChange={(e) => setB2bNotes(e.target.value)}
                            rows={2}
                            maxLength={2000}
                            placeholder="Instrucciones especiales, plazos, etc."
                            className="w-full mb-4 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <button
                            onClick={handleB2bSubmit}
                            disabled={isSubmittingB2B || items.length === 0}
                            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-lg transition-colors"
                          >
                            {isSubmittingB2B ? 'Enviando…' : 'Solicitar Pedido'}
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-700">Total:</span>
                          <span className="font-semibold text-gray-900">
                            {(totalPrice / 1.21).toFixed(2)}€
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-700">IVA:</span>
                          <span className="font-semibold text-gray-900">
                            {(totalPrice - totalPrice / 1.21).toFixed(2)}€
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-700">Envío:</span>
                          <span className="font-semibold text-gray-900">
                            {shippingCost === 0 ? 'Gratis' : `${shippingCost.toFixed(2)}€`}
                          </span>
                        </div>
                        <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900">Total:</span>
                          <span className="text-lg font-bold text-black-600">
                            {finalPrice.toFixed(2)}€
                          </span>
                        </div>
                      </div>

                      {/* Checkout Button */}
                      <button
                        onClick={handleCheckout}
                        disabled={isCheckingOut || items.length === 0}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-lg transition-colors"
                      >
                        {isCheckingOut ? 'Procesando...' : 'Ir a Pagar'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
