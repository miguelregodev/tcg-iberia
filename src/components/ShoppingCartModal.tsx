'use client';

import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShoppingCartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShoppingCartModal({ isOpen, onClose }: ShoppingCartModalProps) {
  const router = useRouter();
  const { items, totalPrice, shippingCost, finalPrice, removeFromCart, updateQuantity } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                {/* Items List */}
                <div className="space-y-4 mb-6">
                  {items.map(item => {
                    const finalPrice = item.product.discountPercentage
                      ? Number(item.product.price) * (1 - Number(item.product.discountPercentage) / 100)
                      : Number(item.product.price);
                    const itemTotal = finalPrice * item.quantity;
                    const stock = Math.max(0, Number(item.product.stock) || 0);
                    const atMax = item.quantity >= stock;

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
                          <p className="text-sm text-gray-600 mb-2">
                            {finalPrice.toFixed(2)}€ / ud
                          </p>
                          {item.product.discountPercentage && (
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
                          <p className="text-lg font-bold text-gray-900 mb-3">
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
                        { (totalPrice - (totalPrice / 1.21)).toFixed(2) }€
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-700">Envío:</span>
                      <span className="font-semibold text-gray-900">
                        {shippingCost === 0
                          ? 'Gratis'
                          : `${shippingCost.toFixed(2)}€`}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-2xl font-bold text-black-600">
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
