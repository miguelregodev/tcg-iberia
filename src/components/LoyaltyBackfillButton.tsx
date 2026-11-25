'use client';

import { useState } from 'react';
import type { LoyaltyBackfillResult } from '@/lib/loyalty/backfill';
import { formatLoyaltyPoints } from '@/lib/loyalty/presentation';

interface LoyaltyBackfillButtonProps {
  userId: string;
  customerLabel: string;
  migratedAt: string | null;
  onMigrated: (result: LoyaltyBackfillResult) => void;
  onConflict?: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Madrid' });

export function LoyaltyBackfillButton({ userId, customerLabel, migratedAt, onMigrated, onConflict }: LoyaltyBackfillButtonProps) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [review, setReview] = useState<LoyaltyBackfillResult['review']>([]);
  const [error, setError] = useState<string | null>(null);

  async function migrate() {
    if (!window.confirm(
      `¿Migrar los puntos de ${customerLabel}? Se abonarán los pedidos pagados de los últimos 60 días con el nivel que tenía en cada compra. Los pedidos ya abonados no se vuelven a abonar.`,
    )) return;
    setRunning(true);
    setError(null);
    setMessage(null);
    setReview([]);
    try {
      const response = await fetch(`/api/admin/loyalty/accounts/${encodeURIComponent(userId)}/backfill`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'No se pudieron migrar los puntos.');
        if (response.status === 409) onConflict?.();
        return;
      }
      const result = data as LoyaltyBackfillResult;
      setMessage(`+${formatLoyaltyPoints(result.points)} de ${result.creditedOrders} pedido(s)`);
      setReview(result.review);
      onMigrated(result);
    } catch {
      setError('No se pudieron migrar los puntos.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1" aria-live="polite">
      {migratedAt ? (
        <span className="whitespace-nowrap text-xs text-text-muted">
          Migrado el <time dateTime={migratedAt}>{dateFormatter.format(new Date(migratedAt))}</time>
        </span>
      ) : (
        <button
          type="button"
          onClick={migrate}
          disabled={running}
          aria-label={`Migrar puntos de ${customerLabel}`}
          className="btn btn-secondary whitespace-nowrap text-xs disabled:opacity-50"
        >
          {running ? 'Migrando…' : 'Migrar puntos'}
        </button>
      )}
      {message && <span role="status" className="max-w-xs text-right text-xs text-success">{message}</span>}
      {review.length > 0 && (
        <div className="max-w-xs text-right text-xs text-warning">
          <p>{review.length} pedido(s) sin abonar. Corrige el dato o ajusta los puntos a mano y vuelve a migrar:</p>
          <ul className="mt-1 space-y-0.5 text-text-secondary">
            {review.map((entry) => (
              <li key={entry.orderNumber}><span className="font-medium text-text-primary">{entry.orderNumber}</span>: {entry.reason}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <span role="alert" className="max-w-xs text-right text-xs text-danger">{error}</span>}
    </div>
  );
}
