'use client';

import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { formatLoyaltyPoints } from '@/lib/loyalty/presentation';

type BalanceState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; points: string; value: string };

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function AccountLoyaltyBalance() {
  const [balance, setBalance] = useState<BalanceState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    async function loadBalance() {
      try {
        const response = await fetch('/api/user/loyalty/balance', { signal: controller.signal, cache: 'no-store' });
        if (response.status === 404) {
          if (!controller.signal.aborted) setBalance({ status: 'unavailable' });
          return;
        }
        if (!response.ok) throw new Error('No se pudo cargar el saldo de puntos.');
        const data: { points: string; value: string } = await response.json();
        if (!controller.signal.aborted) setBalance({ status: 'ready', ...data });
      } catch (error) {
        if (controller.signal.aborted) return;
        Sentry.captureException(error, { tags: { module: 'loyalty_balance' } });
        setBalance({ status: 'error' });
      }
    }
    void loadBalance();
    return () => controller.abort();
  }, []);

  if (balance.status === 'unavailable') return null;

  return (
    <p className="mt-1 text-xs font-semibold text-premium-gold" role="status">
      {balance.status === 'loading' ? 'Cargando puntos…' : balance.status === 'error'
        ? 'No se pudo cargar el saldo de puntos.'
        : `${formatLoyaltyPoints(balance.points)} Puntos (${currencyFormatter.format(Number(balance.value))} €)`}
    </p>
  );
}
