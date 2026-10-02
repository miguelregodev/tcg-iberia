'use client';

import { useCart } from '@/context/CartContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import * as Sentry from '@sentry/nextjs';
import { trackCheckoutFailed, trackCheckoutStarted, trackUserRegistered } from '@/lib/analytics/events';
import { FreeShippingProgress } from './FreeShippingProgress';
import { calculateSubtotal, getFreeShippingState } from '@/lib/shipping/free-shipping';
import { isCanaryIslandsPostalCode, isValidSpanishPostalCode } from '@/lib/shipping/postal-codes';
import { estimateShippingCost } from '@/lib/shipping/client-calculator';
import { SHIPPING_CONFIG } from '@/lib/shipping/config';
import { createOrderItemSnapshot } from '@/lib/orders/items';
import { formatReleaseDate, getProductInventoryState, getProductStatusLabel } from '@/lib/products/state';

export function CheckoutForm() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    items,
    totalPrice,
    totalQuantity,
    shippingCost: defaultShippingCost,
    finalPrice,
    cartId,
    isHydrated,
    updateQuantity,
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockWarning, setStockWarning] = useState<string[] | null>(null);
  const [postalCodeFilled, setPostalCodeFilled] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const [calculatedShippingCost, setCalculatedShippingCost] = useState<number | null>(null);
  const [isCanaryZone, setIsCanaryZone] = useState(false);
  const [groupedShipping, setGroupedShipping] = useState(false);
  const didRunInitialStockCheck = useRef(false);

  const isAuthenticated = status === 'authenticated';

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

  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);

  const effectiveTotal = useMemo(() => {
    if (groupedShipping) return totalPrice;
    if (postalCodeFilled && calculatedShippingCost !== null) return totalPrice + calculatedShippingCost;
    return finalPrice;
  }, [groupedShipping, totalPrice, postalCodeFilled, calculatedShippingCost, finalPrice]);

  // Recalculate shipping cost when cart items change (and postal code is already filled)
  useEffect(() => {
    if (!postalCodeFilled || !formData.shippingPostalCode) return;

    // Check if order qualifies for free shipping (not available in Canary Islands)
    const isCanary = isCanaryIslandsPostalCode(formData.shippingPostalCode);
    const qualifiesForFreeShipping = !isCanary && freeShippingState.qualified;
    
    if (qualifiesForFreeShipping) {
      setCalculatedShippingCost(0);
    } else {
      // Recalculate shipping cost based on updated items
      const shippingCost = estimateShippingCost(
        items.map(item => ({
          quantity: item.quantity,
          weightGrams: item.product.weightGrams,
        })),
        formData.shippingPostalCode
      );
      setCalculatedShippingCost(shippingCost);
    }
  }, [items, totalPrice, freeShippingState, formData.shippingPostalCode, postalCodeFilled]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const prefillProfile = async () => {
      try {
        const response = await fetch('/api/user/profile', { cache: 'no-store' });
        if (!response.ok) return;

        const json = await response.json();
        const profile = json?.data;
        if (!profile || cancelled) return;

        setFormData((prev) => ({
          fullName: prev.fullName || profile.fullName || '',
          email: prev.email || profile.email || session?.user?.email || '',
          phone: prev.phone || profile.phone || '',
          shippingAddress: prev.shippingAddress || profile.addressLine || '',
          shippingPostalCode: prev.shippingPostalCode || profile.postalCode || '',
          shippingCity: prev.shippingCity || profile.city || '',
          shippingLocality: prev.shippingLocality || profile.locality || '',
          shippingProvince: prev.shippingProvince || profile.province || '',
        }));
      } catch (err) {
        Sentry.captureException(err, {
          tags: { module: 'checkout', action: 'prefill_profile' },
        });
      }
    };

    prefillProfile();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, status]);

  // Re-validates current cart items against live stock. Any item that's no longer
  // purchasable (out of stock / unpublished / deleted) gets its quantity zeroed out
  // (removing it from the cart), triggering the shipping-cost recalculation effect
  // above. Returns whether every item was valid, plus the names that were removed.
  const validateCartStock = useCallback(async (): Promise<{ ok: boolean; removedNames: string[] }> => {
    if (items.length === 0) return { ok: true, removedNames: [] };

    const realIds = Array.from(new Set(items.map((item) => item.product.id.replace(/_live$/, ''))));

    try {
      const response = await fetch('/api/products/stock-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: realIds }),
      });

      if (!response.ok) {
        // Fail open: don't block checkout on a transient stock-check error.
        return { ok: true, removedNames: [] };
      }

      const { data } = (await response.json()) as { data: { id: string; canPurchase: boolean }[] };
      const canPurchaseById = new Map(data.map((d) => [d.id, d.canPurchase]));

      const removedNames: string[] = [];
      for (const item of items) {
        const realId = item.product.id.replace(/_live$/, '');
        if (!canPurchaseById.get(realId)) {
          removedNames.push(item.product.name);
          updateQuantity(item.product.id, 0);
        }
      }

      return { ok: removedNames.length === 0, removedNames };
    } catch (err) {
      Sentry.captureException(err, {
        tags: { module: 'checkout', action: 'validate_stock' },
      });
      // Fail open: don't block checkout on a transient network error.
      return { ok: true, removedNames: [] };
    }
  }, [items, updateQuantity]);

  // Run the stock check once, right after the cart finishes loading from localStorage.
  useEffect(() => {
    if (!isHydrated || didRunInitialStockCheck.current) return;
    didRunInitialStockCheck.current = true;

    validateCartStock().then(({ removedNames }) => {
      if (removedNames.length > 0) {
        setStockWarning(removedNames);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  if (items.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        {stockWarning && stockWarning.length > 0 && (
          <div className="p-4 bg-warning-bg border border-warning/30 rounded-lg text-center">
            <p className="text-warning font-semibold mb-1">Algunos productos ya no están disponibles</p>
            <p className="text-warning text-sm">
              Hemos eliminado de tu pedido: {stockWarning.join(', ')}.
            </p>
          </div>
        )}
        <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-8 text-center">
          <p className="text-text-secondary text-lg mb-4">Tu carrito está vacío</p>
          <Link href="/" className="text-premium-gold hover:text-premium-gold_dark font-semibold">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Recalculate shipping cost every time postal code changes
    if (name === 'shippingPostalCode') {
      if (value.trim().length > 0) {
        // Validate postal code format (5 digits, all numeric)
        if (!isValidSpanishPostalCode(value)) {
          setPostalCodeError('El código postal debe tener 5 dígitos numéricos');
          setPostalCodeFilled(false);
          setCalculatedShippingCost(null);
          setIsCanaryZone(false);
          return;
        }
        
        // Valid postal code - clear error and calculate shipping
        setPostalCodeError(null);
        setPostalCodeFilled(true);
        const isCanary = isCanaryIslandsPostalCode(value);
        setIsCanaryZone(isCanary);
        
        // Check if order qualifies for free shipping (not available in Canary Islands)
        const qualifiesForFreeShipping = !isCanary && freeShippingState.qualified;
        if (qualifiesForFreeShipping) {
          // Order amount meets or exceeds the free shipping limit AND is not Canary Islands
          setCalculatedShippingCost(0);
        } else {
          // Calculate real-time shipping cost estimate
          const shippingCost = estimateShippingCost(
            items.map(item => ({
              quantity: item.quantity,
              weightGrams: item.product.weightGrams,
            })),
            value
          );
          setCalculatedShippingCost(shippingCost);
        }
      } else {
        setPostalCodeFilled(false);
        setPostalCodeError(null);
        setCalculatedShippingCost(null);
        setIsCanaryZone(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStockWarning(null);

    // Re-validate stock right before paying: if anything went out of stock since the
    // cart was loaded (or since the last check), zero it out, warn the customer, and
    // stop here — do NOT redirect to Redsys. The customer must review and submit again.
    setIsValidatingStock(true);
    const { ok, removedNames } = await validateCartStock();
    setIsValidatingStock(false);

    if (!ok) {
      setStockWarning(removedNames);
      return;
    }

    setIsProcessing(true);

    trackCheckoutStarted({
      amount: finalPrice,
      paymentMethod: 'redsys',
    });

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

      // Validate postal code format
      if (!isValidSpanishPostalCode(formData.shippingPostalCode)) {
        throw new Error('El código postal debe tener 5 dígitos numéricos');
      }

      // Prepare checkout items
      const checkoutItems = items.map((item) => createOrderItemSnapshot(item.product, item.quantity));

      // Create Redsys payment with customer data
      const response = await fetch('/api/payments/redsys/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: checkoutItems,
          customerData: formData,
          groupedShipping: isAuthenticated && groupedShipping,
          cartId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear el pago');
      }

      const paymentData = await response.json();

      // Track user registration if first time
      const alreadyTracked = window.localStorage.getItem('tcg_user_registered');
      if (!alreadyTracked) {
        trackUserRegistered({
          source: 'checkout',
        });
        window.localStorage.setItem('tcg_user_registered', '1');
      }

      // Submit payment form to Redsys
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = paymentData.url;

      const createInput = (name: string, value: string) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };

      createInput('Ds_SignatureVersion', paymentData.Ds_SignatureVersion);
      createInput('Ds_MerchantParameters', paymentData.Ds_MerchantParameters);
      createInput('Ds_Signature', paymentData.Ds_Signature);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error en el checkout';

      trackCheckoutFailed({
        amount: finalPrice,
        paymentMethod: 'redsys',
        reason: errorMessage,
      });

      Sentry.captureException(err, {
        tags: {
          module: 'checkout',
        },
        extra: {
          page: '/checkout',
          amount: finalPrice,
        },
      });

      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        {/* Form Section */}
        <div className="md:col-span-2">
          <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {stockWarning && stockWarning.length > 0 && (
                <div className="p-4 bg-warning-bg border border-warning/30 rounded-lg">
                  <p className="text-warning font-semibold mb-1">Algunos productos ya no están disponibles</p>
                  <p className="text-warning text-sm">
                    Hemos eliminado de tu pedido: {stockWarning.join(', ')}. Revisa tu pedido antes de continuar.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-4 bg-danger-bg border border-danger/30 rounded-lg">
                  <p className="text-danger font-semibold">{error}</p>
                </div>
              )}

              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-4">
                  Información Personal
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-semibold text-text-secondary mb-2">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Juan Pérez García"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-text-secondary mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-text-secondary mb-2">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+34 612 345 678"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Information */}
              <div>
                <h2 className="text-xl font-bold text-text-primary mb-4">
                  Dirección de Envío
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="shippingAddress" className="block text-sm font-semibold text-text-secondary mb-2">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      id="shippingAddress"
                      name="shippingAddress"
                      value={formData.shippingAddress}
                      onChange={handleChange}
                      placeholder="Calle Principal 123, Apartamento 4B"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shippingPostalCode" className="block text-sm font-semibold text-text-secondary mb-2">
                        Código Postal * {postalCodeFilled && <span className="text-success">✓</span>}
                      </label>
                      <input
                        type="text"
                        id="shippingPostalCode"
                        name="shippingPostalCode"
                        value={formData.shippingPostalCode}
                        onChange={handleChange}
                        placeholder="28001"
                        maxLength={5}
                        className={`w-full px-4 py-2 bg-dark-bgSecondary border ${
                          postalCodeError ? 'border-error' : postalCodeFilled ? 'border-success' : 'border-dark-border'
                        } text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition`}
                        required
                      />
                      {postalCodeError && (
                        <p className="text-error text-xs mt-2">{postalCodeError}</p>
                      )}
                      {postalCodeFilled && !postalCodeError && (
                        <p className="text-success text-xs mt-2">Código postal confirmado • Gastos de envío calculados</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="shippingCity" className="block text-sm font-semibold text-text-secondary mb-2">
                        Ciudad *
                      </label>
                      <input
                        type="text"
                        id="shippingCity"
                        name="shippingCity"
                        value={formData.shippingCity}
                        onChange={handleChange}
                        placeholder="Madrid"
                        className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="shippingLocality" className="block text-sm font-semibold text-text-secondary mb-2">
                      Localidad *
                    </label>
                    <input
                      type="text"
                      id="shippingLocality"
                      name="shippingLocality"
                      value={formData.shippingLocality}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="shippingProvince" className="block text-sm font-semibold text-text-secondary mb-2">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      id="shippingProvince"
                      name="shippingProvince"
                      value={formData.shippingProvince}
                      onChange={handleChange}
                      placeholder="Madrid"
                      className="w-full px-4 py-2 bg-dark-bgSecondary border border-dark-border text-text-primary placeholder-text-muted rounded-lg focus:ring-2 focus:ring-premium-gold focus:border-transparent outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button
                type="submit"
                disabled={isProcessing || isValidatingStock || totalQuantity === 0}
                className="btn btn-primary w-full py-3 px-4 disabled:opacity-60"
              >
                {isValidatingStock
                  ? 'Comprobando disponibilidad...'
                  : isProcessing
                  ? 'Procesando...'
                  : `Pagar de forma segura ${effectiveTotal.toFixed(2)}€`}
              </button>

              {/* Back Link */}
              <Link href="/" className="text-center block text-text-secondary hover:text-premium-gold transition-colors">
                ← Volver a la tienda
              </Link>
            </form>
          </div>
        </div>

        {/* Order Summary Section */}
        <div className="md:col-span-1">
          <div className="bg-dark-surface border border-dark-border rounded-lg shadow-elevated p-8 sticky top-20">
            <h2 className="text-xl font-bold text-text-primary mb-4">Resumen del Pedido</h2>

            <FreeShippingProgress
              state={freeShippingState}
              context="checkout"
              showBar={false}
              className="mb-4"
            />

            <div className="space-y-4 mb-6 max-h-96 overflow-auto">
              {items.map(item => {
                const finalPrice = item.product.discountPercentage
                  ? Number(item.product.price) * (1 - Number(item.product.discountPercentage) / 100)
                  : Number(item.product.price);
                const itemTotal = finalPrice * item.quantity;

                return (
                  <div key={item.product.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-semibold text-text-primary line-clamp-2">
                        {item.product.name}
                      </p>
                      {(item.product.id.endsWith('_live') || item.product.liveOpeningPrice != null) && (
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${
                          item.product.id.endsWith('_live')
                            ? 'bg-warning-bg text-warning'
                            : 'bg-premium-gold/15 text-premium-gold'
                        }`}>
                          {item.product.id.endsWith('_live') ? 'Apertura en Directo' : 'Sellado'}
                        </span>
                      )}
                      {(() => {
                        const state = getProductInventoryState({
                          stock: item.product.stock,
                          releaseDate: item.product.releaseDate,
                        });
                        return !state.isLowStock ? (
                          <p className={`text-xs font-semibold ${
                            state.isPreorder ? 'text-premium-gold' : 'text-text-secondary'
                          }`}>
                            {getProductStatusLabel(state)}
                          </p>
                        ) : null;
                      })()}
                      {item.product.isPreorder && item.product.releaseDate ? (
                        <p className="text-xs text-text-secondary">
                          Lanzamiento: {formatReleaseDate(item.product.releaseDate)}
                        </p>
                      ) : null}
                      <p className="text-text-secondary">x{item.quantity}</p>
                    </div>
                    <p className="font-semibold text-text-primary">
                      {itemTotal.toFixed(2)}€
                    </p>
                  </div>
                );
              })}
            </div>

            {items.some((i) => i.product.isPreorder) && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning-bg p-3 text-xs text-warning space-y-2">
                <p className="font-bold">⚠️ Este pedido incluye productos en preventa.</p>
                <p>Al realizar la reserva, garantizas tu unidad antes del lanzamiento oficial. Los artículos serán enviados una vez estén disponibles y hayan sido recibidos por TCG Iberia de nuestros distribuidores.</p>
                <p>Si el pedido contiene productos en stock y productos en preventa, todo el pedido se enviará conjuntamente cuando los artículos en preventa estén disponibles. Las fechas de lanzamiento pueden variar por causas ajenas a TCG Iberia.</p>
              </div>
            )}

            <div className={`border-t border-dark-border pt-4 space-y-2 ${
              postalCodeFilled ? 'bg-success-bg/10 p-4 rounded-lg' : ''
            }`}>
              <div className="flex justify-between text-sm text-text-secondary">
                <span>Subtotal</span>
                <span className="font-semibold text-text-primary">{totalPrice.toFixed(2)}€</span>
              </div>
              <div className={`flex justify-between text-sm ${
                groupedShipping ? 'text-premium-gold font-semibold' : postalCodeFilled ? 'text-success font-semibold' : 'text-text-secondary'
              }`}>
                <span>Envío {groupedShipping ? '(Agrupado)' : postalCodeFilled && '(Confirmado)'}</span>
                <span className={`font-semibold ${
                  groupedShipping ? 'text-premium-gold' : postalCodeFilled ? 'text-success' : 'text-text-primary'
                }`}>
                  {groupedShipping
                    ? 'Gratis ahora'
                    : calculatedShippingCost === null
                    ? defaultShippingCost === 0
                      ? 'Gratis'
                      : `${defaultShippingCost.toFixed(2)}€`
                    : calculatedShippingCost === 0
                    ? 'Gratis'
                    : `${calculatedShippingCost.toFixed(2)}€`
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-text-primary pt-2 border-t border-dark-border">
                <span>Total:</span>
                <span className="text-premium-gold text-sm">
                  {effectiveTotal.toFixed(2)}€
                </span>
              </div>
            </div>

            {/* "Agrupar Envío" — only offered to authenticated customers (guest checkout unaffected) */}
            {isAuthenticated && (
              <div className="mt-4 border border-dark-border rounded-lg p-4 bg-dark-bgSecondary">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={groupedShipping}
                    onChange={(e) => setGroupedShipping(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-dark-border text-premium-gold focus:ring-premium-gold accent-[#F5E77A]"
                    aria-describedby="grouped-shipping-help"
                  />
                  <span className="text-sm font-semibold text-text-primary">Agrupar Envío</span>
                </label>
                <p id="grouped-shipping-help" className="mt-2 text-xs text-text-secondary leading-relaxed">
                  Retrasa el envío de este pedido para poder agruparlo con futuras compras y ahorrar en
                  gastos de envío. Podrás solicitar el envío cuando quieras desde &ldquo;Mis pedidos&rdquo;.{' '}
                  <Link href="/envio-agrupado" className="text-premium-gold underline-offset-4 hover:underline">
                    Más información
                  </Link>
                </p>
                {groupedShipping && (
                  <p className="mt-2 text-xs font-semibold text-premium-gold">
                    Este pedido no se enviará todavía. Se pagará igualmente en su totalidad ahora; el envío
                    quedará pendiente hasta que lo solicites.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
