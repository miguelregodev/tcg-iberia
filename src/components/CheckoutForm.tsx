'use client';

import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function CheckoutForm() {
  const router = useRouter();
  const { items, totalPrice, shippingCost, finalPrice } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    shippingAddress: '',
    shippingPostalCode: '',
    shippingCity: '',
    shippingLocality: '',
    shippingProvince: '',
  });

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-700 text-lg mb-4">Tu carrito está vacío</p>
        <Link href="/" className="text-red-600 hover:text-red-700 font-semibold">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // Validate form data
      if (
        !formData.fullName ||
        !formData.email ||
        !formData.phone ||
        !formData.shippingAddress ||
        !formData.shippingPostalCode ||
        !formData.shippingCity ||
        !formData.shippingLocality ||
        !formData.shippingProvince
      ) {
        throw new Error('Por favor completa todos los campos');
      }

      // Prepare checkout items
      const checkoutItems = items.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: Number(item.product.price),
        discountPercentage: item.product.discountPercentage
          ? Number(item.product.discountPercentage)
          : undefined,
        imageUrl: item.product.imageUrl || undefined,
      }));

      // Create Stripe checkout session with customer data
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: checkoutItems,
          customerData: formData,
          shippingCost,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear la sesión de pago');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error en el checkout';
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-semibold">{error}</p>
                </div>
              )}

              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Información Personal
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Juan Pérez García"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+34 612 345 678"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Information */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  Dirección de Envío
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="shippingAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      id="shippingAddress"
                      name="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={handleChange}
                      placeholder="Calle Principal 123, Apartamento 4B"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shippingPostalCode" className="block text-sm font-semibold text-gray-700 mb-2">
                        Código Postal *
                      </label>
                      <input
                        type="text"
                        id="shippingPostalCode"
                        name="shippingPostalCode"
                        value={formData.shippingPostalCode}
                        onChange={handleChange}
                        placeholder="28001"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="shippingCity" className="block text-sm font-semibold text-gray-700 mb-2">
                        Ciudad *
                      </label>
                      <input
                        type="text"
                        id="shippingCity"
                        name="shippingCity"
                        value={formData.shippingCity}
                        onChange={handleChange}
                        placeholder="Madrid"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="shippingLocality" className="block text-sm font-semibold text-gray-700 mb-2">
                      Localidad *
                    </label>
                    <input
                      type="text"
                      id="shippingLocality"
                      name="shippingLocality"
                      value={formData.shippingLocality}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="shippingProvince" className="block text-sm font-semibold text-gray-700 mb-2">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      id="shippingProvince"
                      name="shippingProvince"
                      value={formData.shippingProvince}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
              >
                {isProcessing ? 'Procesando...' : `Pagar ${finalPrice.toFixed(2)}€`}
              </button>

              {/* Back Link */}
              <Link href="/" className="text-center text-gray-600 hover:text-gray-800">
                ← Volver a la tienda
              </Link>
            </form>
          </div>
        </div>

        {/* Order Summary Section */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow-md p-8 sticky top-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen del Pedido</h2>

            <div className="space-y-4 mb-6 max-h-96 overflow-auto">
              {items.map(item => {
                const finalPrice = item.product.discountPercentage
                  ? Number(item.product.price) * (1 - Number(item.product.discountPercentage) / 100)
                  : Number(item.product.price);
                const itemTotal = finalPrice * item.quantity;

                return (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-semibold text-gray-900 line-clamp-2">
                        {item.product.name}
                      </p>
                      <p className="text-gray-600">x{item.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {itemTotal.toFixed(2)}€
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-700">
                <span>Subtotal</span>
                <span className="font-semibold text-gray-900">{totalPrice.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-sm text-gray-700">
                <span>Envío</span>
                <span className="font-semibold text-gray-900">
                  {shippingCost === 0 ? 'Gratis' : `${shippingCost.toFixed(2)}€`}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span className="text-red-600">{finalPrice.toFixed(2)}€</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
