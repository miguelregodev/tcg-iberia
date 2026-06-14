'use client';

import { useEffect, useState } from 'react';

interface StockAlertModalProps {
  isOpen: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function StockAlertModal({
  isOpen,
  loading = false,
  onClose,
  onSubmit,
}: StockAlertModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setError(null);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      setError('El correo electrónico es obligatorio.');
      return;
    }

    if (!EMAIL_REGEX.test(normalized)) {
      setError('Introduce un correo electrónico válido.');
      return;
    }

    setError(null);
    await onSubmit(normalized);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 md:p-8 animate-slideUp">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
          aria-label="Cerrar modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Te notificaremos por email cuando el producto vuelva a estar disponible
        </h2>

        <p className="text-sm text-gray-500 mb-6">
          Introduce tu correo electrónico y te avisaremos en cuanto haya stock.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="stock-alert-email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="stock-alert-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="tu@email.com"
              required
            />
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Notifícame'}
          </button>
        </form>
      </div>
    </div>
  );
}
