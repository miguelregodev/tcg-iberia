'use client';

/**
 * Admin B2B management page.
 *
 * Two tabs:
 *   1. Solicitudes  → pending / approved / rejected requests
 *                      · Review form (edit collected documentation)
 *                      · Approve / Reject actions
 *   2. Clientes     → approved customers
 *                      · Filter by status + free-text search
 *                      · Edit / Enable / Disable / Delete / Resend activation
 *
 * All API calls go through `/api/admin/b2b/**` which are gated by the
 * existing `tcg_admin_auth` cookie — this page inherits admin auth from the
 * shared AdminNav layout convention.
 */

import { useCallback, useEffect, useState } from 'react';
import { AdminNav } from '@/components/AdminNav';

// ── Types ───────────────────────────────────────────────────────────────────

type B2bRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type B2bCustomerStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';
type B2bActivity =
  | 'ONLINE_STORE'
  | 'VENDING_MACHINE'
  | 'PHYSICAL_STORE'
  | 'DISTRIBUTOR'
  | 'OTHER';

interface B2bRequest {
  id: string;
  email: string;
  status: B2bRequestStatus;
  companyName: string | null;
  vatNumber: string | null;
  modelo036Verified: boolean;
  activity: B2bActivity | null;
  activityOther: string | null;
  shippingAddress: string | null;
  billingAddress: string | null;
  contactName: string | null;
  nationalId: string | null;
  phone: string | null;
  website: string | null;
  estimatedVolume: string | null;
  preferredLanguages: string | null;
  notes: string | null;
  reviewedAt: string | null;
  reviewedByEmail: string | null;
  rejectionReason: string | null;
  customerId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface B2bCustomer {
  id: string;
  email: string;
  status: B2bCustomerStatus;
  companyName: string;
  vatNumber: string;
  activity: B2bActivity;
  activityOther: string | null;
  shippingAddress: string;
  billingAddress: string | null;
  contactName: string;
  nationalId: string | null;
  phone: string;
  website: string | null;
  estimatedVolume: string | null;
  preferredLanguages: string | null;
  notes: string | null;
  lastLoginAt: string | null;
  disabledAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Notification {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: Array<{ value: B2bActivity; label: string }> = [
  { value: 'ONLINE_STORE', label: 'Tienda online' },
  { value: 'VENDING_MACHINE', label: 'Vending' },
  { value: 'PHYSICAL_STORE', label: 'Tienda física' },
  { value: 'DISTRIBUTOR', label: 'Distribuidor' },
  { value: 'OTHER', label: 'Otro' },
];

const REQUEST_STATUS_LABEL: Record<B2bRequestStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const REQUEST_STATUS_BADGE: Record<B2bRequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-700',
};

const CUSTOMER_STATUS_LABEL: Record<B2bCustomerStatus, string> = {
  PENDING: 'Pendiente de activación',
  ACTIVE: 'Activo',
  DISABLED: 'Desactivado',
};

const CUSTOMER_STATUS_BADGE: Record<B2bCustomerStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACTIVE: 'bg-green-100 text-green-800',
  DISABLED: 'bg-gray-200 text-gray-700',
};

const inputClass =
  'w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors disabled:bg-gray-50 disabled:text-gray-500';

// ── Utilities ───────────────────────────────────────────────────────────────

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
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

// ── Page ────────────────────────────────────────────────────────────────────

export default function AdminB2bPage() {
  const [tab, setTab] = useState<'requests' | 'customers' | 'orders'>('requests');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pushNotification = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
              n.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {n.message}
          </div>
        ))}
      </div>

      <div className="container-custom px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">B2B</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las solicitudes de cuenta mayorista y los clientes activos.
          </p>
        </div>

        <div className="mb-6 flex border-b border-gray-200">
          {(['requests', 'customers', 'orders'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'requests'
                ? 'Solicitudes'
                : t === 'customers'
                  ? 'Clientes'
                  : 'Pedidos'}
            </button>
          ))}
        </div>

        {tab === 'requests' ? (
          <RequestsTab notify={pushNotification} />
        ) : tab === 'customers' ? (
          <CustomersTab notify={pushNotification} />
        ) : (
          <OrdersTab notify={pushNotification} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Requests Tab
// ─────────────────────────────────────────────────────────────────────────────

function RequestsTab({
  notify,
}: {
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | B2bRequestStatus>('PENDING');
  const [requests, setRequests] = useState<B2bRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState<B2bRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        statusFilter === 'ALL'
          ? '/api/admin/b2b/requests'
          : `/api/admin/b2b/requests?status=${statusFilter}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { requests: B2bRequest[] };
      setRequests(data.requests ?? []);
    } catch {
      notify('error', 'No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, notify]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <label className="text-sm text-gray-600">Estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | B2bRequestStatus)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">Todas</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
          </select>
          <span className="ml-auto text-xs text-gray-500">
            {requests.length} solicitudes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay solicitudes para este filtro.
                  </td>
                </tr>
              )}
              {!loading &&
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.email}</td>
                    <td className="px-4 py-3 text-gray-700">{r.companyName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          REQUEST_STATUS_BADGE[r.status]
                        }`}
                      >
                        {REQUEST_STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setReviewing(r)}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800"
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {reviewing && (
        <RequestReviewModal
          request={reviewing}
          onClose={() => setReviewing(null)}
          onChanged={() => {
            setReviewing(null);
            void fetchRequests();
          }}
          notify={notify}
        />
      )}
    </>
  );
}

// ── Request review modal ────────────────────────────────────────────────────

function RequestReviewModal({
  request,
  onClose,
  onChanged,
  notify,
}: {
  request: B2bRequest;
  onClose: () => void;
  onChanged: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const readOnly = request.status !== 'PENDING';
  const [form, setForm] = useState({
    companyName: request.companyName ?? '',
    vatNumber: request.vatNumber ?? '',
    modelo036Verified: request.modelo036Verified,
    activity: (request.activity ?? '') as B2bActivity | '',
    activityOther: request.activityOther ?? '',
    shippingAddress: request.shippingAddress ?? '',
    billingAddress: request.billingAddress ?? '',
    contactName: request.contactName ?? '',
    nationalId: request.nationalId ?? '',
    phone: request.phone ?? '',
    website: request.website ?? '',
    estimatedVolume: request.estimatedVolume ?? '',
    preferredLanguages: request.preferredLanguages ?? '',
    notes: request.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const bind = <K extends keyof typeof form>(field: K) => ({
    value: form[field] as string | boolean,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      const value =
        e.target.type === 'checkbox'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((p) => ({ ...p, [field]: value }));
    },
  });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/b2b/requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'save');
      }
      notify('success', 'Cambios guardados.');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    if (!window.confirm('¿Aprobar esta solicitud y crear el cliente B2B?')) return;
    setApproving(true);
    // Save any pending edits first so the approval uses the latest data.
    await save();
    try {
      const res = await fetch(`/api/admin/b2b/requests/${request.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'No se pudo aprobar la solicitud.');
      notify('success', 'Solicitud aprobada. Se ha enviado el email de activación.');
      onChanged();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Error.');
    } finally {
      setApproving(false);
    }
  };

  const reject = async () => {
    if (!window.confirm('¿Rechazar esta solicitud?')) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/b2b/requests/${request.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'reject');
      }
      notify('success', 'Solicitud rechazada.');
      onChanged();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Error.');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 animate-fadeIn"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Revisar solicitud</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="font-medium text-gray-700">{request.email}</span> ·{' '}
              {formatDate(request.createdAt)} ·{' '}
              <span className={`px-1.5 py-0.5 rounded ${REQUEST_STATUS_BADGE[request.status]}`}>
                {REQUEST_STATUS_LABEL[request.status]}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Razón social" required>
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                {...(bind('companyName') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
            <Field label="NIF / CIF / VAT" required>
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                {...(bind('vatNumber') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="modelo036"
              type="checkbox"
              checked={form.modelo036Verified}
              onChange={(e) => setForm((p) => ({ ...p, modelo036Verified: e.target.checked }))}
              disabled={readOnly}
              className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="modelo036" className="text-sm text-gray-700">
              Modelo 036 verificado
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tipo de actividad" required>
              <select
                value={form.activity}
                onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value as B2bActivity }))}
                disabled={readOnly}
                className={inputClass}
              >
                <option value="">— Selecciona —</option>
                {ACTIVITY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.activity === 'OTHER' && (
              <Field label="Describe la actividad">
                <input
                  type="text"
                  className={inputClass}
                  disabled={readOnly}
                  {...(bind('activityOther') as React.InputHTMLAttributes<HTMLInputElement>)}
                />
              </Field>
            )}
          </div>

          <Field label="Dirección de envío" required>
            <textarea
              rows={2}
              className={inputClass}
              disabled={readOnly}
              {...(bind('shippingAddress') as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          </Field>

          <Field label="Dirección de facturación (si es distinta)">
            <textarea
              rows={2}
              className={inputClass}
              disabled={readOnly}
              {...(bind('billingAddress') as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Persona de contacto" required>
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                {...(bind('contactName') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
            <Field label="DNI / NIE / Pasaporte">
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                {...(bind('nationalId') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Teléfono" required>
              <input
                type="tel"
                className={inputClass}
                disabled={readOnly}
                {...(bind('phone') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
            <Field label="Sitio web">
              <input
                type="url"
                className={inputClass}
                disabled={readOnly}
                {...(bind('website') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Volumen mensual estimado">
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                {...(bind('estimatedVolume') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
            <Field label="Idiomas preferentes">
              <input
                type="text"
                className={inputClass}
                disabled={readOnly}
                placeholder="Ej.: Japonés, Inglés"
                {...(bind('preferredLanguages') as React.InputHTMLAttributes<HTMLInputElement>)}
              />
            </Field>
          </div>

          <Field label="Notas adicionales">
            <textarea
              rows={3}
              className={inputClass}
              disabled={readOnly}
              {...(bind('notes') as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          </Field>

          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm">
              <div className="font-semibold text-gray-700 mb-1">Motivo del rechazo:</div>
              <div className="text-gray-600 whitespace-pre-wrap">{request.rejectionReason}</div>
            </div>
          )}

          {!readOnly && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              <div className="font-semibold mb-1">Antes de aprobar</div>
              Asegúrate de haber verificado el Modelo 036 y de que todos los datos son correctos. Una vez aprobada, se creará el cliente y se enviará automáticamente el email de activación.
            </div>
          )}
        </div>

        {!readOnly && (
          <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <input
                type="text"
                placeholder="Motivo del rechazo (opcional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={reject}
                disabled={rejecting || approving}
                className="whitespace-nowrap px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {rejecting ? 'Rechazando…' : 'Rechazar'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving || approving || rejecting}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={approving || rejecting}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {approving ? 'Aprobando…' : 'Aprobar y crear cliente'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customers Tab
// ─────────────────────────────────────────────────────────────────────────────

function CustomersTab({
  notify,
}: {
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [customers, setCustomers] = useState<B2bCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | B2bCustomerStatus>('ALL');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<B2bCustomer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(
        `/api/admin/b2b/customers${params.size ? `?${params.toString()}` : ''}`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { customers: B2bCustomer[] };
      setCustomers(data.customers ?? []);
    } catch {
      notify('error', 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query, notify]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const handleEnable = useCallback(
    async (c: B2bCustomer) => {
      const res = await fetch(`/api/admin/b2b/customers/${c.id}/enable`, { method: 'POST' });
      if (!res.ok) {
        notify('error', 'No se pudo activar.');
        return;
      }
      notify('success', 'Cliente activado.');
      void fetchCustomers();
    },
    [fetchCustomers, notify]
  );

  const handleDisable = useCallback(
    async (c: B2bCustomer) => {
      if (!window.confirm(`¿Desactivar a "${c.companyName}"?`)) return;
      const res = await fetch(`/api/admin/b2b/customers/${c.id}/disable`, { method: 'POST' });
      if (!res.ok) {
        notify('error', 'No se pudo desactivar.');
        return;
      }
      notify('success', 'Cliente desactivado.');
      void fetchCustomers();
    },
    [fetchCustomers, notify]
  );

  const handleDelete = useCallback(
    async (c: B2bCustomer) => {
      if (
        !window.confirm(
          `¿Eliminar permanentemente el cliente "${c.companyName}"? Esta acción no se puede deshacer.`
        )
      )
        return;
      const res = await fetch(`/api/admin/b2b/customers/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        notify('error', 'No se pudo eliminar.');
        return;
      }
      notify('success', 'Cliente eliminado.');
      void fetchCustomers();
    },
    [fetchCustomers, notify]
  );

  const handleResend = useCallback(
    async (c: B2bCustomer) => {
      const res = await fetch(`/api/admin/b2b/customers/${c.id}/resend-activation`, {
        method: 'POST',
      });
      if (!res.ok) {
        notify('error', 'No se pudo reenviar el enlace.');
        return;
      }
      notify('success', 'Enlace de activación reenviado por email.');
    },
    [notify]
  );

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empresa, email, CIF…"
            className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | B2bCustomerStatus)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Pendiente</option>
            <option value="ACTIVE">Activo</option>
            <option value="DISABLED">Desactivado</option>
          </select>
          <span className="ml-auto text-xs text-gray-500">
            {customers.length} clientes
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Empresa</th>
                <th className="px-4 py-3 text-left">Contacto</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">NIF/CIF</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Creado</th>
                <th className="px-4 py-3 text-left">Último acceso</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Sin clientes.
                  </td>
                </tr>
              )}
              {!loading &&
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="max-w-[220px] truncate" title={c.companyName}>
                        {c.companyName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.contactName}</td>
                    <td className="px-4 py-3 text-gray-700">{c.email}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{c.vatNumber}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          CUSTOMER_STATUS_BADGE[c.status]
                        }`}
                      >
                        {CUSTOMER_STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(c.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="px-2.5 py-1 rounded text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Editar
                        </button>
                        {c.status === 'DISABLED' ? (
                          <button
                            type="button"
                            onClick={() => handleEnable(c)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            Activar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDisable(c)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-amber-700 hover:bg-amber-50"
                          >
                            Desactivar
                          </button>
                        )}
                        {c.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => handleResend(c)}
                            className="px-2.5 py-1 rounded text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Reenviar activación
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="px-2.5 py-1 rounded text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <CustomerEditModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void fetchCustomers();
          }}
          notify={notify}
        />
      )}
    </>
  );
}

function CustomerEditModal({
  customer,
  onClose,
  onSaved,
  notify,
}: {
  customer: B2bCustomer;
  onClose: () => void;
  onSaved: () => void;
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState({
    companyName: customer.companyName,
    vatNumber: customer.vatNumber,
    activity: customer.activity,
    activityOther: customer.activityOther ?? '',
    shippingAddress: customer.shippingAddress,
    billingAddress: customer.billingAddress ?? '',
    contactName: customer.contactName,
    nationalId: customer.nationalId ?? '',
    phone: customer.phone,
    website: customer.website ?? '',
    estimatedVolume: customer.estimatedVolume ?? '',
    preferredLanguages: customer.preferredLanguages ?? '',
    notes: customer.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/b2b/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'save');
      }
      notify('success', 'Cliente actualizado.');
      onSaved();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-slideUp">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Editar cliente B2B</h2>
            <p className="text-xs text-gray-500 mt-0.5">{customer.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Razón social" required>
              <input
                type="text"
                className={inputClass}
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
              />
            </Field>
            <Field label="NIF / CIF" required>
              <input
                type="text"
                className={inputClass}
                value={form.vatNumber}
                onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Actividad" required>
              <select
                className={inputClass}
                value={form.activity}
                onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value as B2bActivity }))}
              >
                {ACTIVITY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            {form.activity === 'OTHER' && (
              <Field label="Describe la actividad">
                <input
                  type="text"
                  className={inputClass}
                  value={form.activityOther}
                  onChange={(e) => setForm((p) => ({ ...p, activityOther: e.target.value }))}
                />
              </Field>
            )}
          </div>
          <Field label="Dirección de envío" required>
            <textarea
              rows={2}
              className={inputClass}
              value={form.shippingAddress}
              onChange={(e) => setForm((p) => ({ ...p, shippingAddress: e.target.value }))}
            />
          </Field>
          <Field label="Dirección de facturación">
            <textarea
              rows={2}
              className={inputClass}
              value={form.billingAddress}
              onChange={(e) => setForm((p) => ({ ...p, billingAddress: e.target.value }))}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Persona de contacto" required>
              <input
                type="text"
                className={inputClass}
                value={form.contactName}
                onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
              />
            </Field>
            <Field label="DNI/NIE/Pasaporte">
              <input
                type="text"
                className={inputClass}
                value={form.nationalId}
                onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Teléfono" required>
              <input
                type="tel"
                className={inputClass}
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label="Sitio web">
              <input
                type="url"
                className={inputClass}
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Volumen estimado">
              <input
                type="text"
                className={inputClass}
                value={form.estimatedVolume}
                onChange={(e) => setForm((p) => ({ ...p, estimatedVolume: e.target.value }))}
              />
            </Field>
            <Field label="Idiomas preferentes">
              <input
                type="text"
                className={inputClass}
                value={form.preferredLanguages}
                onChange={(e) =>
                  setForm((p) => ({ ...p, preferredLanguages: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="Notas">
            <textarea
              rows={3}
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field helper ────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders Tab
// ─────────────────────────────────────────────────────────────────────────────

type B2bOrderStatus = 'PENDING' | 'ACCEPTED' | 'PAID' | 'CANCELLED' | 'REJECTED';

interface AdminOrderLine {
  productId: string;
  name: string;
  variant?: 'SHRINK' | 'NO_SHRINK';
  quantity: number;
  unitPriceEur: number;
  lineTotal: number;
}

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: B2bOrderStatus;
  subtotal: number;
  ivaAmount: number;
  total: number;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  items: AdminOrderLine[];
  notes: string | null;
  createdAt: string;
  customer: {
    id: string;
    companyName: string;
    email: string;
    vatNumber: string;
    contactName: string;
    phone: string;
    shippingAddress: string;
  };
}

const ORDER_STATUS_LABEL: Record<B2bOrderStatus, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aprobado',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rechazado',
};

const ORDER_STATUS_BADGE: Record<B2bOrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
  REJECTED: 'bg-gray-200 text-gray-700',
};

const eurFmtAdmin = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

function OrdersTab({
  notify,
}: {
  notify: (type: 'success' | 'error', message: string) => void;
}) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | B2bOrderStatus>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        statusFilter === 'ALL'
          ? '/api/admin/b2b/orders'
          : `/api/admin/b2b/orders?status=${statusFilter}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { orders: AdminOrder[] };
      setOrders(data.orders ?? []);
    } catch {
      notify('error', 'No se pudieron cargar los pedidos.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, notify]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const accept = useCallback(
    async (o: AdminOrder) => {
      if (
        !window.confirm(
          `¿Aprobar el pedido ${o.orderNumber} de ${o.customer.companyName}? Se generará la factura y se enviará por email.`
        )
      )
        return;
      setBusy(o.id);
      try {
        const res = await fetch(`/api/admin/b2b/orders/${o.id}/accept`, {
          method: 'POST',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'accept');
        notify('success', `Pedido ${o.orderNumber} aprobado. Factura ${data.order.invoiceNumber} enviada.`);
        void fetchOrders();
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Error al aprobar.');
      } finally {
        setBusy(null);
      }
    },
    [notify, fetchOrders]
  );

  const reject = useCallback(
    async (o: AdminOrder) => {
      const reason = window.prompt(`Motivo del rechazo del pedido ${o.orderNumber} (opcional):`);
      if (reason === null) return;
      setBusy(o.id);
      try {
        const res = await fetch(`/api/admin/b2b/orders/${o.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'reject');
        notify('success', `Pedido ${o.orderNumber} rechazado.`);
        void fetchOrders();
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Error al rechazar.');
      } finally {
        setBusy(null);
      }
    },
    [notify, fetchOrders]
  );

  const markPaid = useCallback(
    async (o: AdminOrder) => {
      if (!window.confirm(`Marcar el pedido ${o.orderNumber} como pagado?`)) return;
      setBusy(o.id);
      try {
        const res = await fetch(`/api/admin/b2b/orders/${o.id}/mark-paid`, {
          method: 'POST',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'mark-paid');
        notify('success', `Pedido ${o.orderNumber} marcado como pagado.`);
        void fetchOrders();
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Error.');
      } finally {
        setBusy(null);
      }
    },
    [notify, fetchOrders]
  );

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      <div className="p-4 flex flex-wrap items-center gap-3 border-b border-gray-100">
        <label className="text-sm text-gray-600">Estado:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | B2bOrderStatus)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="ALL">Todos</option>
          <option value="PENDING">Pendientes</option>
          <option value="ACCEPTED">Aprobados</option>
          <option value="PAID">Pagados</option>
          <option value="CANCELLED">Cancelados</option>
          <option value="REJECTED">Rechazados</option>
        </select>
        <span className="ml-auto text-xs text-gray-500">{orders.length} pedidos</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Factura</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay pedidos para este filtro.
                </td>
              </tr>
            )}
            {!loading &&
              orders.map((o) => {
                const isOpen = expanded === o.id;
                return (
                  <>
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => setExpanded(isOpen ? null : o.id)}
                        >
                          {o.orderNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {o.customer.companyName}
                        </div>
                        <div className="text-xs text-gray-500">{o.customer.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                        {o.invoiceNumber ? (
                          <a
                            href={`/api/admin/b2b/orders/${o.id}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline"
                          >
                            {o.invoiceNumber}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {eurFmtAdmin.format(o.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_BADGE[o.status]}`}
                        >
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {o.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => accept(o)}
                                disabled={busy === o.id}
                                className="px-2.5 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                onClick={() => reject(o)}
                                disabled={busy === o.id}
                                className="px-2.5 py-1 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                            </>
                          )}
                          {o.status === 'ACCEPTED' && (
                            <button
                              type="button"
                              onClick={() => markPaid(o)}
                              disabled={busy === o.id}
                              className="px-2.5 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Marcar pagado
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${o.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid md:grid-cols-2 gap-6">
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                Cliente
                              </div>
                              <div className="text-sm text-gray-800 space-y-0.5">
                                <div><strong>{o.customer.companyName}</strong></div>
                                <div>NIF/CIF: {o.customer.vatNumber}</div>
                                <div>Contacto: {o.customer.contactName}</div>
                                <div>{o.customer.email} · {o.customer.phone}</div>
                                <div>Dirección: {o.customer.shippingAddress}</div>
                              </div>
                              {o.notes && (
                                <div className="mt-3 p-2 rounded bg-white border border-gray-200 text-xs text-gray-600">
                                  <strong>Notas:</strong> {o.notes}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                Líneas
                              </div>
                              <ul className="divide-y divide-gray-200 text-sm">
                                {o.items.map((it, idx) => (
                                  <li
                                    key={`${o.id}-${idx}`}
                                    className="flex justify-between py-1.5"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate" title={it.name}>
                                        {it.name}
                                        {it.variant === 'NO_SHRINK' && (
                                          <span className="ml-1 text-xs text-gray-500">
                                            (sin plástico)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {it.quantity} × {eurFmtAdmin.format(it.unitPriceEur)}
                                      </div>
                                    </div>
                                    <div className="font-mono">
                                      {eurFmtAdmin.format(it.lineTotal)}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end gap-6 text-xs">
                                <div>Base: <span className="font-mono">{eurFmtAdmin.format(o.subtotal)}</span></div>
                                <div>IVA 21%: <span className="font-mono">{eurFmtAdmin.format(o.ivaAmount)}</span></div>
                                <div className="font-bold">Total: <span className="font-mono">{eurFmtAdmin.format(o.total)}</span></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
