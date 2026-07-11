'use client';

/**
 * B2B account activation page.
 *
 * URL: /b2b/activar/[token]
 *
 * 1. Validates the token via GET  /api/b2b/activate/[token]
 * 2. On success, shows a password-setup form and calls POST /api/b2b/activate/[token]
 * 3. Redirects to the home page once the account is active (the API also
 *    issues a session so the user is logged in immediately).
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useB2BSession } from '@/context/B2BSessionContext';

interface PageProps {
  params: Promise<{ token: string }>;
}

const inputClass =
  'w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500';

interface CustomerSummary {
  email: string;
  contactName: string;
  companyName: string;
}

export default function B2bActivationPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();
  const { refresh } = useB2BSession();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // ── Validate the token on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/b2b/activate/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setValid(false);
          setError(data.error ?? 'Enlace de activación no válido.');
        } else {
          setValid(true);
          setCustomer(data.customer);
        }
      } catch {
        if (!cancelled) {
          setValid(false);
          setError('No se pudo validar el enlace.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Mínimo 8 caracteres, con al menos una letra y un número.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/b2b/activate/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'No se pudo activar la cuenta.');
        return;
      }
      setDone(true);
      // Refresh the session context so the app immediately knows the user is B2B.
      await refresh();
      // Give the user a moment to read the success message.
      setTimeout(() => router.push('/'), 2500);
    } catch {
      setError('Ha ocurrido un error. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold tracking-wide uppercase">
            TCG Iberia · B2B
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">
            {done ? '¡Cuenta activada!' : 'Activa tu cuenta'}
          </h1>
          {customer && !done && (
            <p className="mt-1 text-sm text-gray-500">
              Hola <strong className="text-gray-800">{customer.contactName}</strong>, define
              tu contraseña para acceder a las tarifas mayoristas de{' '}
              <strong className="text-gray-800">{customer.companyName}</strong>.
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <span className="h-8 w-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && !valid && (
          <div className="text-center space-y-4">
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error ?? 'Enlace no válido o expirado.'}
            </div>
            <a
              href="/"
              className="inline-block text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Volver a la tienda
            </a>
          </div>
        )}

        {!loading && valid && !done && (
          <>
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <input
                  id="pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className={inputClass}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label htmlFor="pw2" className="block text-sm font-medium text-gray-700 mb-1">
                  Repetir contraseña
                </label>
                <input
                  id="pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={submitting}
                  className={inputClass}
                  placeholder="Repite la contraseña"
                />
              </div>
              <p className="text-xs text-gray-500">
                Mínimo 8 caracteres, con al menos una letra y un número.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? 'Activando…' : 'Activar mi cuenta'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div className="text-center space-y-4">
            <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              Tu cuenta ya está activa. Te estamos redirigiendo…
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
