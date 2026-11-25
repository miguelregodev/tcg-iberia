'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminNav } from '@/components/AdminNav';
import { InlinePointsEditor } from '@/components/InlinePointsEditor';
import { LoyaltyBackfillButton } from '@/components/LoyaltyBackfillButton';
import type { LoyaltyBackfillResult } from '@/lib/loyalty/backfill';
import type { LoyaltyConfigInput, LoyaltyTierConfig } from '@/lib/loyalty/config';
import type { LoyaltyAccountPage } from '@/lib/loyalty/admin-accounts';
import { formatLoyaltyPoints, formatTierMultiplier } from '@/lib/loyalty/presentation';

type AccountPage = LoyaltyAccountPage;
const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

type Settings = LoyaltyConfigInput & { enabled: boolean; available: boolean; localPreview: boolean; checkout: boolean };
type DecimalSetting = 'baseRate' | 'pointsPerEuro' | 'minimumRedemption' | 'redemptionIncrement' | 'maxDiscountPercent';

const fields: Array<{ key: DecimalSetting; label: string }> = [
  { key: 'baseRate', label: 'Puntos por euro elegible' },
  { key: 'pointsPerEuro', label: 'Puntos por euro de descuento' },
  { key: 'minimumRedemption', label: 'Canje mínimo de puntos' },
  { key: 'redemptionIncrement', label: 'Incremento de puntos' },
  { key: 'maxDiscountPercent', label: 'Descuento máximo (%)' },
];

const inputClass = 'w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold';
const cardClass = 'rounded-xl border border-dark-border bg-dark-surface p-5 shadow-sm';
const labelTextClass = 'block text-sm font-medium text-text-primary';
const errorClass = 'rounded-lg border border-danger bg-danger-bg px-4 py-3 text-sm text-danger';
const successClass = 'rounded-lg border border-success bg-success-bg px-4 py-3 text-sm text-success';

function AdjustmentForm() {
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`¿Ajustar ${points} puntos a la cuenta indicada?`)) return;
    idempotencyKey.current ||= crypto.randomUUID();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/loyalty/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, points, reason, idempotencyKey: idempotencyKey.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo realizar el ajuste.');
      setMessage(`Ajuste registrado. Saldo: ${data.balance} puntos.`);
      idempotencyKey.current = null;
      setPoints('');
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo realizar el ajuste.');
    } finally {
      setSaving(false);
    }
  }

  function resetKey() { idempotencyKey.current = null; }

  return (
    <form onSubmit={submit} className={`mt-8 space-y-4 ${cardClass}`}>
      <h2 className="text-base font-semibold text-text-primary">Ajuste manual de prueba</h2>
      <label className="block space-y-1">
        <span className={labelTextClass}>Correo del cliente</span>
        <input className={inputClass} type="email" required value={email} onChange={(event) => { setEmail(event.target.value); resetKey(); }} />
      </label>
      <label className="block space-y-1">
        <span className={labelTextClass}>Puntos positivos o negativos</span>
        <input className={inputClass} inputMode="decimal" required value={points} onChange={(event) => { setPoints(event.target.value); resetKey(); }} />
      </label>
      <label className="block space-y-1">
        <span className={labelTextClass}>Motivo</span>
        <textarea className={inputClass} required maxLength={2000} value={reason} onChange={(event) => { setReason(event.target.value); resetKey(); }} />
      </label>
      {error && <p role="alert" className={errorClass}>{error}</p>}
      {message && <p role="status" className={successClass}>{message}</p>}
      <button type="submit" className="btn btn-primary text-sm disabled:opacity-50" disabled={saving}>{saving ? 'Guardando…' : 'Aplicar ajuste'}</button>
    </form>
  );
}

function CollapsibleSection({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <details className={`group ${cardClass}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="font-semibold text-text-primary">{title}</span>
          {summary && <span className="ml-2 text-sm text-text-secondary">{summary}</span>}
        </span>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-dark-border text-text-secondary transition-transform group-open:rotate-180 group-hover:text-premium-gold"
        >
          ▾
        </span>
      </summary>
      <fieldset className="mt-4">
        <legend className="sr-only">{title}</legend>
        {children}
      </fieldset>
    </details>
  );
}

function LoyaltyAccountsTable({ pointsPerEuro }: { pointsPerEuro: string }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<AccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('q', search);
    fetch(`/api/admin/loyalty/accounts?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'No se pudieron cargar los clientes.');
        setData(body);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, pageSize, search, reloadToken]);

  const rate = Number(pointsPerEuro);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reload = () => setReloadToken((value) => value + 1);

  function updateBalance(userId: string, balance: string) {
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) => item.userId === userId ? { ...item, balance } : item),
    }));
  }

  function markMigrated(result: LoyaltyBackfillResult) {
    setData((current) => current && ({
      ...current,
      items: current.items.map((item) => item.userId === result.userId
        ? { ...item, balance: result.balance, historicalBackfillAt: result.migratedAt }
        : item),
    }));
  }

  return (
    <section className="mt-8" aria-labelledby="loyalty-accounts-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="loyalty-accounts-title" className="text-lg font-bold text-text-primary">Puntos de clientes</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Pulsa sobre los puntos para cambiar el saldo. La diferencia se registra como ajuste manual en el historial del cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="loyalty-search" className="sr-only">Buscar cliente</label>
          <input
            id="loyalty-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por correo o nombre"
            className="w-64 rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
          />
          <label htmlFor="loyalty-page-size" className="sr-only">Clientes por página</label>
          <select
            id="loyalty-page-size"
            value={pageSize}
            onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
            className="rounded-lg border border-dark-border bg-dark-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-premium-gold"
          >
            {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
      </div>

      {error && <p role="alert" className={`mb-4 ${errorClass}`}>{error}</p>}

      <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-dark-bgSecondary text-xs uppercase tracking-wide text-text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold">Nivel</th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">Puntos</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Valor</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Reservados</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Migración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {loading && !data ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">Cargando...</td></tr>
              ) : !data || data.items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-text-muted">No hay clientes.</td></tr>
              ) : (
                data.items.map((item) => {
                  const value = rate > 0 ? Math.floor((Math.max(0, Number(item.balance)) / rate) * 100) / 100 : 0;
                  return (
                    <tr key={item.userId} className="hover:bg-dark-surfaceHover">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{item.fullName || '—'}</div>
                        <div className="text-xs text-text-muted">{item.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-text-primary">
                          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.tier.color }} />
                          {item.tier.name}
                          <span className="text-xs font-normal text-text-muted">{formatTierMultiplier(item.tier.multiplier)}</span>
                        </span>
                        <div className="text-xs text-text-muted">{euroFormatter.format(Number(item.spending))} en la ventana</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <InlinePointsEditor
                          key={`${item.userId}:${item.balance}`}
                          userId={item.userId}
                          customerLabel={item.email}
                          balance={item.balance}
                          onBalanceUpdated={(balance) => updateBalance(item.userId, balance)}
                          onConflict={reload}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">{euroFormatter.format(value)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">
                        {Number(item.reserved) > 0 ? formatLoyaltyPoints(item.reserved) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <LoyaltyBackfillButton
                          userId={item.userId}
                          customerLabel={item.email}
                          migratedAt={item.historicalBackfillAt}
                          onMigrated={markMigrated}
                          onConflict={reload}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
          <span aria-live="polite">{data.total} clientes · página {data.page} de {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary text-sm disabled:opacity-50" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <button type="button" className="btn btn-secondary text-sm disabled:opacity-50" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function LoyaltySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch('/api/admin/loyalty/config');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'No se pudo cargar la configuración.');
        if (active) setSettings(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  function updateTier(index: number, patch: Partial<LoyaltyTierConfig>) {
    setSettings((current) => current && ({
      ...current,
      tiers: current.tiers.map((tier, i) => i === index ? { ...tier, ...patch } : tier),
    }));
  }

  function moveTier(index: number, direction: -1 | 1) {
    setSettings((current) => {
      if (!current) return current;
      const tiers = [...current.tiers];
      const target = index + direction;
      if (target < 0 || target >= tiers.length) return current;
      [tiers[index], tiers[target]] = [tiers[target], tiers[index]];
      return { ...current, tiers };
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings || !window.confirm('¿Guardar estos cambios en la configuración de fidelización?')) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          reason,
          tiers: settings.tiers.map((tier) => ({
            ...tier,
            benefits: tier.benefits.filter((benefit) => benefit.trim()),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la configuración.');
      setSettings(data);
      setReason('');
      setMessage('Configuración guardada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      <AdminNav />
      <main className="container-custom max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-text-primary">Configuración de fidelización</h1>
        {settings && <p className="mt-2 text-sm text-text-secondary">
          {settings.localPreview ? 'Vista previa local: ' : ''}
          {!settings.available
            ? 'El programa no está disponible en este entorno. Define LOYALTY_ENABLED=1 para habilitarlo.'
            : settings.checkout
              ? 'Compras y canjes de puntos habilitados. Las devoluciones no ajustan los puntos automáticamente; corrígelas con un ajuste manual.'
              : 'Solo permite ajustes manuales. Las compras y los canjes no están activos (LOYALTY_CHECKOUT_ENABLED).'}
        </p>}
        <p className="mt-1 text-sm text-text-secondary">La configuración se administra con la sesión del backoffice.</p>
        {loading && <p role="status" className="mt-6 py-16 text-center text-sm text-text-muted">Cargando configuración…</p>}
        {error && <p role="alert" className={`mt-6 ${errorClass}`}>{error}</p>}
        {message && <p role="status" className={`mt-6 ${successClass}`}>{message}</p>}
        {settings && (
          <form
            onSubmit={save}
            onInvalidCapture={(event) => {
              const section = (event.target as HTMLElement).closest('details');
              if (section) section.open = true;
            }}
            className="mt-6 space-y-6"
          >
            <CollapsibleSection title="Reglas generales">
              {settings.available && (
                <label className="mb-4 flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" className="h-4 w-4 rounded border-dark-border text-premium-gold focus:ring-premium-gold" checked={settings.enabled}
                    onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />
                  {settings.localPreview ? 'Activar vista previa solo en este entorno local' : 'Activar programa de fidelización'}
                </label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(({ key, label }) => (
                  <label key={key} className="space-y-1">
                    <span className={labelTextClass}>{label}</span>
                    <input className={inputClass} inputMode="decimal" required value={settings[key]}
                      onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} />
                  </label>
                ))}
                <label className="space-y-1">
                  <span className={labelTextClass}>Periodo de evaluación (días)</span>
                  <input className={inputClass} type="number" min="1" max="3650" required value={settings.evaluationDays}
                    onChange={(event) => setSettings({ ...settings, evaluationDays: Number(event.target.value) })} />
                </label>
                <label className="space-y-1">
                  <span className={labelTextClass}>Caducidad (meses)</span>
                  <input className={inputClass} type="number" min="1" max="120" required value={settings.expirationMonths}
                    onChange={(event) => setSettings({ ...settings, expirationMonths: Number(event.target.value) })} />
                </label>
              </div>
            </CollapsibleSection>
            {settings.tiers.map((tier, index) => (
              <CollapsibleSection
                key={index}
                title={`Nivel ${index + 1}`}
                summary={[tier.name, tier.multiplier && Number.isFinite(Number(tier.multiplier)) && formatTierMultiplier(tier.multiplier), tier.threshold && `desde ${tier.threshold} €`]
                  .filter(Boolean).join(' · ')}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ['name', 'Nombre'],
                    ['threshold', 'Umbral sin impuestos (€)'],
                    ['multiplier', 'Multiplicador'],
                    ['color', 'Color (#RRGGBB)'],
                    ['icon', 'Icono'],
                    ['description', 'Descripción'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="space-y-1">
                      <span className={labelTextClass}>{label}</span>
                      <input className={inputClass} value={tier[key]}
                        onChange={(event) => updateTier(index, { [key]: event.target.value })} />
                    </label>
                  ))}
                  <label className="space-y-1 sm:col-span-2">
                    <span className={labelTextClass}>Beneficios (uno por línea; no se activan automáticamente)</span>
                    <textarea className={inputClass} rows={3} value={tier.benefits.join('\n')}
                      onChange={(event) => updateTier(index, { benefits: event.target.value.split('\n') })} />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="btn btn-secondary text-sm disabled:opacity-50" disabled={index === 0} onClick={() => moveTier(index, -1)}>Subir nivel</button>
                  <button type="button" className="btn btn-secondary text-sm disabled:opacity-50" disabled={index === settings.tiers.length - 1} onClick={() => moveTier(index, 1)}>Bajar nivel</button>
                </div>
              </CollapsibleSection>
            ))}
            <label className="block space-y-1">
              <span className={labelTextClass}>Motivo del cambio</span>
              <textarea className={inputClass} required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary text-sm disabled:opacity-50" disabled={saving || (settings.enabled && !settings.available)}>
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </button>
          </form>
        )}
        {settings?.available && settings.enabled && <LoyaltyAccountsTable pointsPerEuro={settings.pointsPerEuro} />}
        {settings?.available && settings.enabled && <AdjustmentForm />}
      </main>
    </div>
  );
}
