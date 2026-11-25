'use client';

import { useRef, useState } from 'react';
import { formatLoyaltyPoints } from '@/lib/loyalty/presentation';

interface InlinePointsEditorProps {
  userId: string;
  customerLabel: string;
  balance: string;
  onBalanceUpdated: (balance: string) => void;
  onConflict?: () => void;
}

export function InlinePointsEditor({ userId, customerLabel, balance, onBalanceUpdated, onConflict }: InlinePointsEditorProps) {
  const shown = formatLoyaltyPoints(balance);
  const editValue = String(Math.max(0, Math.floor(Number(balance))));
  const [isEditing, setIsEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(editValue);
  const [isUpdating, setIsUpdating] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const hasChanged = newBalance.trim() !== editValue;

  const handleEdit = () => {
    setNewBalance(editValue);
    idempotencyKey.current = null;
    setIsEditing(true);
  };

  const handleCancel = () => {
    setNewBalance(editValue);
    idempotencyKey.current = null;
    setIsEditing(false);
  };

  const handleUpdate = async () => {
    const value = newBalance.trim();
    if (!/^\d{1,10}$/.test(value)) {
      alert('Por favor ingresa un número entero de puntos (≥ 0)');
      return;
    }
    if (!hasChanged) {
      setIsEditing(false);
      return;
    }
    idempotencyKey.current ||= crypto.randomUUID();
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/loyalty/accounts/${encodeURIComponent(userId)}/balance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: value, expectedBalance: balance, idempotencyKey: idempotencyKey.current }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        idempotencyKey.current = null;
        setIsEditing(false);
        onBalanceUpdated(data.balance);
        return;
      }
      alert(`Error: ${data.error || 'No se pudo actualizar el saldo'}`);
      if (response.status === 409) {
        idempotencyKey.current = null;
        setIsEditing(false);
        onConflict?.();
      }
    } catch (err) {
      alert('Error al actualizar el saldo');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const negative = Number(balance) < 0;
  const empty = Number(balance) === 0;

  if (!isEditing) {
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleEdit}
          aria-label={`Editar puntos de ${customerLabel}: ${shown}`}
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold ${
            negative
              ? 'bg-danger-bg text-danger'
              : empty
              ? 'bg-dark-surfaceHover text-text-muted'
              : 'bg-success-bg text-success'
          }`}
        >
          {shown}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      <input
        type="number"
        min="0"
        step="1"
        value={newBalance}
        onChange={(e) => { setNewBalance(e.target.value); idempotencyKey.current = null; }}
        disabled={isUpdating}
        autoFocus
        aria-label={`Nuevo saldo de puntos de ${customerLabel}`}
        className="w-24 px-2 py-1 text-xs rounded-lg border border-dark-border bg-dark-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold text-center disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleUpdate();
          if (e.key === 'Escape') handleCancel();
        }}
      />
      {hasChanged && (
        <>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={isUpdating}
            title="Confirmar actualización"
            aria-label="Confirmar actualización"
            className="p-1 text-success hover:text-success/80 transition-colors disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUpdating}
            title="Cancelar"
            aria-label="Cancelar"
            className="p-1 text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
