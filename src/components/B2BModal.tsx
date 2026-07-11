'use client';

/**
 * B2BModal
 *
 * Dual-mode modal used across the site for wholesale account access:
 *   - `login`   → email + password form → POST /api/b2b/login
 *   - `request` → email-only form       → POST /api/b2b/request
 *
 * The two modes toggle via a small link at the bottom of the panel. Follows
 * the same aesthetic as `LoginModal` (backdrop, centered panel, animate-fadeIn
 * / animate-slideUp, red-600 primary buttons).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useB2BSession } from '@/context/B2BSessionContext';

type Mode = 'login' | 'request';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Optional starting mode. Defaults to 'login'. */
  initialMode?: Mode;
}

const inputClass =
  'w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500';

export function B2BModal({ isOpen, onClose, initialMode = 'login' }: Props) {
  const router = useRouter();
  const { refresh } = useB2BSession();
  const { data: customerSession } = useSession();
  const hasCustomerSession = !!customerSession?.user;
  const [mode, setMode] = useState<Mode>(initialMode);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset form + mode whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setEmail('');
    setPassword('');
    setError(null);
    setSuccess(null);
  }, [isOpen, initialMode]);

  // Body-scroll lock + Escape to close.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      if (!email.trim() || !password) {
        setError('Introduce email y contraseña.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/b2b/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'No se pudo iniciar sesión.');
          return;
        }
        // Success → redirect to B2B catalog
        await refresh();
        onClose();
        router.push('/b2b-catalog');
        router.refresh();
      } catch {
        setError('Ha ocurrido un error. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [email, password, refresh, router, onClose]
  );

  const handleRequest = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      if (!email.trim()) {
        setError('Introduce tu correo electrónico.');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/b2b/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'No se pudo enviar la solicitud.');
          return;
        }
        setSuccess(
          'Solicitud recibida. Te hemos enviado un correo con la documentación que necesitamos para activar tu cuenta.'
        );
        setEmail('');
      } catch {
        setError('Ha ocurrido un error. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn"
      aria-modal="true"
      role="dialog"
      aria-labelledby="b2b-modal-title"
    >
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-slideUp">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold tracking-wide uppercase">
            TCG Iberia · B2B
          </div>
          <h2 id="b2b-modal-title" className="mt-3 text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Acceso mayorista' : 'Solicita tu cuenta B2B'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {mode === 'login'
              ? 'Introduce tus credenciales para ver tarifas mayoristas.'
              : 'Escribe tu email y te enviaremos la documentación que necesitamos.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {hasCustomerSession ? (
          <div className="mb-4 px-4 py-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-2">
            <p>
              Estás dentro como cliente particular
              {customerSession?.user?.email ? ` (${customerSession.user.email})` : ''}. Cierra la
              sesión de cliente antes de acceder al portal B2B.
            </p>
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                router.refresh();
                onClose();
              }}
              className="w-full text-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Cerrar sesión de cliente
            </button>
          </div>
        ) : mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="b2b-email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="b2b-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className={inputClass}
                placeholder="empresa@ejemplo.com"
              />
            </div>
            <div>
              <label htmlFor="b2b-password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                id="b2b-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Accediendo…' : 'Acceder'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4" noValidate>
            <div>
              <label htmlFor="b2b-req-email" className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="b2b-req-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || !!success}
                className={inputClass}
                placeholder="empresa@ejemplo.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full py-3 px-4 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando…' : success ? 'Solicitud enviada' : 'Solicitar cuenta B2B'}
            </button>
          </form>
        )}

        {!hasCustomerSession && (
          <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('request');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Solicita tu cuenta B2B para acceder a tarifas mayoristas
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Volver a iniciar sesión
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
