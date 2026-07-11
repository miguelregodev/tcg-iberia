'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { trackEvent } from '@/lib/analytics/events';
import { useB2BSession } from '@/context/B2BSessionContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const { isB2B, customer: b2bCustomer, logout: logoutB2B } = useB2BSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset form on close
      setEmail('');
      setPassword('');
      setError(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // NextAuth surfaces the credentials-provider error message as-is.
        // We use `b2b_session_active` (see src/lib/auth.ts) to signal the
        // mutual-exclusion check refused the login.
        if (result.error === 'b2b_session_active') {
          setError(
            'Ya has iniciado sesión como B2B. Cierra la sesión mayorista antes de acceder como cliente.'
          );
          trackEvent('user_login_failed', { reason: 'b2b_session_active' });
        } else {
          setError('Email o contraseña incorrectos.');
          trackEvent('user_login_failed', { reason: 'invalid_credentials' });
        }
      } else {
        trackEvent('user_logged_in', { method: 'email' });
        onClose();
        router.refresh();
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { module: 'auth', action: 'login_modal' } });
      setError('Ha ocurrido un error. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn"
      aria-modal="true"
      role="dialog"
      aria-labelledby="login-modal-title"
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-8 animate-slideUp">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="login-modal-title" className="text-h3 mb-6 text-center">
          Acceder
        </h2>

        {isB2B ? (
          <div className="mb-4 px-4 py-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-2">
            <p>
              Estás dentro del portal B2B como{' '}
              <strong>{b2bCustomer?.companyName ?? 'cliente mayorista'}</strong>. Debes
              cerrar la sesión mayorista antes de acceder como cliente particular.
            </p>
            <button
              type="button"
              onClick={async () => {
                await logoutB2B();
                onClose();
              }}
              className="w-full text-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Cerrar sesión B2B
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Accediendo...' : 'Acceder'}
          </button>
        </form>

        {/* Register link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            ¿No tienes cuenta?
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.location.href = '/registro';
            }}
            className="mt-2 w-full btn btn-secondary text-sm"
            disabled={loading}
          >
            Registrarse
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
