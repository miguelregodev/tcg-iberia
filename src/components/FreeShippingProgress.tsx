'use client';

import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/nextjs';
import {
  trackFreeShippingProgressViewed,
  trackFreeShippingQualified,
} from '@/lib/analytics/events';
import { FreeShippingState } from '@/lib/shipping/free-shipping';

interface FreeShippingProgressProps {
  state: FreeShippingState;
  context: 'cart' | 'mini_cart' | 'checkout';
  showBar?: boolean;
  emptyCart?: boolean;
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function FreeShippingProgress({
  state,
  context,
  showBar = true,
  emptyCart = false,
  className = '',
}: FreeShippingProgressProps) {
  const hasTrackedViewRef = useRef(false);
  const hasTrackedQualifiedRef = useRef(false);

  useEffect(() => {
    try {
      if (!hasTrackedViewRef.current) {
        trackFreeShippingProgressViewed({
          cartValue: state.cartValue,
          threshold: state.threshold,
          remainingAmount: state.remainingAmount,
          percentage: Math.round(state.percentage),
          context,
        });
        hasTrackedViewRef.current = true;
      }

      if (state.qualified && !hasTrackedQualifiedRef.current) {
        trackFreeShippingQualified({
          cartValue: state.cartValue,
          threshold: state.threshold,
          context,
        });
        hasTrackedQualifiedRef.current = true;
      }

      if (!state.qualified) {
        hasTrackedQualifiedRef.current = false;
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { module: 'free-shipping-progress', context },
      });
    }
  }, [context, state.cartValue, state.percentage, state.qualified, state.remainingAmount, state.threshold]);

  const title = state.qualified
    ? '🎉 ¡Ya tienes envío gratuito!'
    : `Te faltan ${formatCurrency(state.remainingAmount)} para conseguir envío gratuito.`;

  // Empty cart variant - simple banner
  if (emptyCart) {
    return (
      <div
        className={`py-1 text-center text-xs font-semibold text-gray-700 ${className}`}
        aria-label="Información de envío gratuito"
      >
        Envío gratuito a partir de 200€
      </div>
    );
  }

  // Full progress variant
  return (
    <section
      className={`rounded-xl border border-gray-200 bg-gray-50 p-2 ${className}`}
      aria-label="Estado de envío gratuito"
    >
      <p className={`text-xs font-semibold ${state.qualified ? 'text-green-700' : 'text-gray-800'}`}>
        {title}
      </p>

      {showBar && (
        <>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                state.qualified ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ width: `${state.percentage}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
            <span>{formatCurrency(state.cartValue)}</span>
            <span>{Math.round(state.percentage)}%</span>
            <span>{formatCurrency(state.threshold)}</span>
          </div>
          <div
            className="sr-only"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.percentage)}
            aria-valuetext={`${Math.round(state.percentage)} por ciento hacia el envío gratuito`}
          />
        </>
      )}
    </section>
  );
}
