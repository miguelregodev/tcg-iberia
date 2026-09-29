'use client';

/**
 * B2B customer profile page.
 *
 * URL: /mi-cuenta/b2b/perfil
 *
 * Read-only view of the customer's own registered data (company, contact,
 * fiscal + shipping information). Direct editing is not exposed here — B2B
 * customer records are the source of truth for legally-issued invoices, so
 * updates must be requested from the sales team via email.
 *
 * When the session is not B2B active, redirects the user to the home page
 * with a friendly notice.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useB2BSession } from '@/context/B2BSessionContext';
import { B2B_COMPANY } from '@/lib/b2b/company';

interface Profile {
  id: string;
  email: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  companyName: string;
  vatNumber: string;
  activityLabel: string;
  shippingAddress: string;
  billingAddress: string | null;
  contactName: string;
  nationalId: string | null;
  phone: string;
  website: string | null;
  estimatedVolume: string | null;
  preferredLanguages: string | null;
  lastLoginAt: string | null;
  activatedAt: string | null;
  createdAt: string;
}

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function B2bProfilePage() {
  const { isB2B, loading: sessionLoading } = useB2BSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isB2B) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/b2b/profile', { 
          cache: 'no-store',
          credentials: 'include',
        });
        if (!res.ok) {
          setError('No se pudo cargar el perfil.');
          return;
        }
        const data = (await res.json()) as { customer: Profile };
        if (!cancelled) setProfile(data.customer);
      } catch {
        if (!cancelled) setError('No se pudo cargar el perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isB2B]);

  if (sessionLoading) {
    return (
      <main className="min-h-screen bg-dark-bg flex items-center justify-center">
        <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!isB2B) {
    return (
      <main className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-dark-surface border border-dark-border rounded-2xl shadow-elevated p-8">
          <h1 className="text-xl font-bold text-text-primary mb-2">Acceso B2B requerido</h1>
          <p className="text-sm text-text-secondary mb-4">
            Debes iniciar sesión con una cuenta B2B activa para ver tu perfil mayorista.
          </p>
          <Link
            href="/"
            className="inline-block btn btn-primary"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-dark-bg py-10">
      <div className="container-custom px-4 max-w-3xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Mi perfil B2B</h1>
            <p className="text-sm text-text-secondary mt-1">
              Datos registrados para tu cuenta mayorista.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/mi-cuenta/b2b/pedidos"
              className="btn btn-secondary text-sm py-2"
            >
              Mis pedidos
            </Link>
            <Link
              href="/b2b-catalog"
              className="btn btn-primary text-sm py-2"
            >
              Ir al catálogo
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-danger-bg border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {loading && !profile && (
          <div className="flex items-center justify-center py-16">
            <span className="h-8 w-8 rounded-full border-2 border-premium-gold border-t-transparent animate-spin" />
          </div>
        )}

        {profile && (
          <div className="space-y-4">
            {/* Company block */}
            <section className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
              <header className="px-5 py-4 border-b border-dark-border">
                <h2 className="text-base font-semibold text-text-primary">Datos de la empresa</h2>
              </header>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
                <ProfileField label="Razón social" value={profile.companyName} />
                <ProfileField label="NIF / CIF / VAT" value={profile.vatNumber} mono />
                <ProfileField label="Actividad" value={profile.activityLabel} />
                <ProfileField label="Email" value={profile.email} />
                <ProfileField label="Teléfono" value={profile.phone} />
                <ProfileField label="Sitio web" value={profile.website} />
              </dl>
            </section>

            {/* Contact block */}
            <section className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
              <header className="px-5 py-4 border-b border-dark-border">
                <h2 className="text-base font-semibold text-text-primary">
                  Persona de contacto
                </h2>
              </header>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
                <ProfileField label="Nombre" value={profile.contactName} />
                <ProfileField
                  label="DNI / NIE / Pasaporte"
                  value={profile.nationalId}
                  mono
                />
              </dl>
            </section>

            {/* Address block */}
            <section className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
              <header className="px-5 py-4 border-b border-dark-border">
                <h2 className="text-base font-semibold text-text-primary">Direcciones</h2>
              </header>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
                <ProfileField
                  label="Dirección de envío"
                  value={profile.shippingAddress}
                  multiline
                />
                <ProfileField
                  label="Dirección de facturación"
                  value={profile.billingAddress ?? '— usa la de envío —'}
                  multiline
                />
              </dl>
            </section>

            {/* Commercial block */}
            <section className="rounded-2xl bg-dark-surface border border-dark-border shadow-sm">
              <header className="px-5 py-4 border-b border-dark-border">
                <h2 className="text-base font-semibold text-text-primary">Datos comerciales</h2>
              </header>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
                <ProfileField
                  label="Volumen mensual estimado"
                  value={profile.estimatedVolume}
                />
                <ProfileField
                  label="Idiomas preferentes"
                  value={profile.preferredLanguages}
                />
                <ProfileField label="Cuenta activada el" value={formatDate(profile.activatedAt)} />
                <ProfileField label="Último acceso" value={formatDate(profile.lastLoginAt)} />
              </dl>
            </section>

            {/* Update contact card */}
            <section className="rounded-2xl bg-premium-gold/10 border border-premium-gold/30 p-5 text-sm">
              <div className="font-semibold text-premium-gold mb-1">
                ¿Necesitas actualizar algún dato?
              </div>
              <p className="text-text-primary">
                Para modificar los datos fiscales, direcciones o cualquier información de tu
                cuenta B2B, escríbenos a{' '}
                <a
                  className="font-semibold underline text-premium-gold"
                  href={`mailto:${B2B_COMPANY.email}`}
                >
                  {B2B_COMPANY.email}
                </a>{' '}
                indicando tu razón social y los cambios solicitados.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Field helper ────────────────────────────────────────────────────────────
function ProfileField({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  multiline?: boolean;
}) {
  const display = value?.toString().trim() || '—';
  return (
    <div>
      <dt className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd
        className={`text-text-primary ${mono ? 'font-mono text-sm' : ''} ${
          multiline ? 'whitespace-pre-line' : ''
        }`}
      >
        {display}
      </dd>
    </div>
  );
}
