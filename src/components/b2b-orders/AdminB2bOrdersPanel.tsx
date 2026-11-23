'use client';

/**
 * Admin B2B orders panel: server-side filtered / sorted / paginated table of
 * every B2B order, plus entry points to create an order and open the detail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  B2bAdminOrderListItem,
  B2bFulfillmentStatusValue,
  B2bOrderLifecycleStatus,
  B2bPaymentStatusValue,
  Paginated,
} from '@/types';
import {
  B2B_FULFILLMENT_STATUS_LABEL,
  B2B_ORDER_STATUS_LABEL,
  B2B_PAYMENT_STATUS_LABEL,
} from '@/lib/b2b/order-status';
import {
  Badge,
  DocumentStatusBadge,
  FulfillmentBadge,
  LifecycleBadge,
  PaymentBadge,
  btnPrimary,
  btnSecondary,
  carrierLabel,
  eurFmt,
  formatDateTime,
  inputClass,
} from './B2bOrderUi';
import { AdminB2bOrderCreateModal } from './AdminB2bOrderCreateModal';
import { AdminB2bOrderDetailModal } from './AdminB2bOrderDetailModal';

type Notify = (type: 'success' | 'error', message: string) => void;

interface AdminB2bOrdersPanelProps {
  notify: Notify;
}

interface Filters {
  q: string;
  email: string;
  company: string;
  vat: string;
  orderNumber: string;
  status: '' | B2bOrderLifecycleStatus;
  paymentStatus: '' | B2bPaymentStatusValue;
  fulfillmentStatus: '' | B2bFulfillmentStatusValue;
  invoice: '' | 'issued' | 'none' | 'failed';
  source: '' | 'CUSTOMER' | 'ADMIN';
  from: string;
  to: string;
}

type SortField = 'createdAt' | 'total' | 'status' | 'paymentStatus' | 'fulfillmentStatus';

const EMPTY_FILTERS: Filters = {
  q: '',
  email: '',
  company: '',
  vat: '',
  orderNumber: '',
  status: '',
  paymentStatus: '',
  fulfillmentStatus: '',
  invoice: '',
  source: '',
  from: '',
  to: '',
};
const TEXT_FILTERS: Array<keyof Filters> = ['q', 'email', 'company', 'vat', 'orderNumber'];
const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function AdminB2bOrdersPanel({ notify }: AdminB2bOrdersPanelProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<B2bAdminOrderListItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedFilters = useDebounced(filters, 350);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    (Object.keys(debouncedFilters) as Array<keyof Filters>).forEach((k) => {
      const v = debouncedFilters[k].trim();
      if (v) params.set(k, v);
    });
    params.set('sort', sort.field);
    params.set('dir', sort.dir);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [debouncedFilters, sort, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedFilters, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/b2b/orders?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'load');
        setData((await res.json()) as Paginated<B2bAdminOrderListItem>);
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') notify('error', 'No se pudieron cargar los pedidos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, reloadToken, notify]);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const activeFilterCount = (Object.keys(filters) as Array<keyof Filters>).filter(
    (k) => filters[k] !== '' && !TEXT_FILTERS.includes(k)
  ).length;

  const toggleSort = (field: SortField) =>
    setSort((prev) => ({ field, dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc' }));

  const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => {
    const active = sort.field === field;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold rounded"
        >
          {label}
          <span aria-hidden="true">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    );
  };

  const select = (
    id: keyof Filters,
    label: string,
    options: Array<[string, string]>
  ) => (
    <div>
      <label htmlFor={`b2b-filter-${id}`} className="block text-xs text-text-secondary mb-1">
        {label}
      </label>
      <select
        id={`b2b-filter-${id}`}
        value={filters[id]}
        onChange={(e) => setFilter(id, e.target.value as never)}
        className={inputClass}
      >
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );

  const textInput = (id: keyof Filters, label: string, placeholder: string, type = 'text') => (
    <div>
      <label htmlFor={`b2b-filter-${id}`} className="block text-xs text-text-secondary mb-1">
        {label}
      </label>
      <input
        id={`b2b-filter-${id}`}
        type={type}
        value={filters[id]}
        onChange={(e) => setFilter(id, e.target.value as never)}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );

  const orders = data?.items ?? [];

  return (
    <div className="bg-dark-surface border border-dark-border rounded-2xl shadow-sm">
      <div className="p-4 border-b border-dark-border space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem]">
            <label htmlFor="b2b-filter-q" className="block text-xs text-text-secondary mb-1">
              Buscar
            </label>
            <input
              id="b2b-filter-q"
              type="search"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Nº pedido, factura, empresa, email, NIF o seguimiento"
              className={inputClass}
            />
          </div>
          {select('paymentStatus', 'Pago', Object.entries(B2B_PAYMENT_STATUS_LABEL))}
          {select('fulfillmentStatus', 'Envío', Object.entries(B2B_FULFILLMENT_STATUS_LABEL))}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            aria-controls="b2b-advanced-filters"
            className={btnSecondary}
          >
            Más filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>
            + Nuevo pedido
          </button>
        </div>

        {showAdvanced && (
          <div id="b2b-advanced-filters" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {textInput('orderNumber', 'Nº de pedido', 'PED-2026-…')}
            {textInput('email', 'Email del cliente', 'cliente@empresa.com')}
            {textInput('company', 'Empresa / contacto', 'Razón social')}
            {textInput('vat', 'NIF / CIF', 'B12345678')}
            {select('status', 'Estado del pedido', Object.entries(B2B_ORDER_STATUS_LABEL))}
            {select('invoice', 'Factura', [
              ['issued', 'Emitida'],
              ['none', 'Sin factura'],
              ['failed', 'Con error / pendiente'],
            ])}
            {select('source', 'Origen', [
              ['CUSTOMER', 'Cliente (carrito)'],
              ['ADMIN', 'Administrador'],
            ])}
            <div className="grid grid-cols-2 gap-2">
              {textInput('from', 'Desde', '', 'date')}
              {textInput('to', 'Hasta', '', 'date')}
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button type="button" className={btnSecondary} onClick={() => setFilters(EMPTY_FILTERS)}>
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Pedidos B2B</caption>
          <thead className="bg-dark-bgSecondary text-xs text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-3 text-left uppercase tracking-wider">Pedido</th>
              <th scope="col" className="px-3 py-3 text-left uppercase tracking-wider">Cliente</th>
              <SortHeader field="createdAt" label="Fecha" />
              <SortHeader field="total" label="Total" align="right" />
              <SortHeader field="status" label="Pedido" />
              <SortHeader field="paymentStatus" label="Pago" />
              <SortHeader field="fulfillmentStatus" label="Envío" />
              <th scope="col" className="px-3 py-3 text-left uppercase tracking-wider">Seguimiento</th>
              <th scope="col" className="px-3 py-3 text-left uppercase tracking-wider">Factura</th>
              <th scope="col" className="px-3 py-3 text-right uppercase tracking-wider">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border" aria-busy={loading}>
            {loading && orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-text-muted">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-text-muted">
                  No hay pedidos para estos filtros.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className={`hover:bg-dark-surfaceHover ${loading ? 'opacity-60' : ''}`}>
                <td className="px-3 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setOpenOrderId(o.id)}
                    className="font-mono text-xs text-premium-gold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-premium-gold rounded"
                  >
                    {o.orderNumber}
                  </button>
                  <div className="mt-1">
                    <Badge className="bg-dark-bg text-text-muted">{o.source === 'ADMIN' ? 'Admin' : 'Cliente'}</Badge>
                  </div>
                </td>
                <td className="px-3 py-3 min-w-[12rem]">
                  <div className="font-medium text-text-primary">{o.customer.companyName}</div>
                  <div className="text-xs text-text-secondary">{o.customer.email}</div>
                  <div className="text-xs text-text-muted font-mono">{o.customer.vatNumber}</div>
                </td>
                <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-text-primary">{eurFmt.format(o.total)}</td>
                <td className="px-3 py-3"><LifecycleBadge status={o.status} /></td>
                <td className="px-3 py-3"><PaymentBadge status={o.paymentStatus} /></td>
                <td className="px-3 py-3"><FulfillmentBadge status={o.fulfillmentStatus} /></td>
                <td className="px-3 py-3 text-xs text-text-secondary whitespace-nowrap">
                  {o.trackingNumber ? (
                    <>
                      <div>{carrierLabel(o.shippingProvider)}</div>
                      <div className="font-mono">{o.trackingNumber}</div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-3 text-xs whitespace-nowrap">
                  {o.invoiceNumber ? (
                    <div className="space-y-1">
                      <div className="font-mono text-text-primary">{o.invoiceNumber}</div>
                      {o.invoiceStatus && o.invoiceStatus !== 'ISSUED' && <DocumentStatusBadge status={o.invoiceStatus} />}
                    </div>
                  ) : (
                    <span className="text-text-muted">Sin factura</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <button type="button" onClick={() => setOpenOrderId(o.id)} className={btnSecondary}>
                    Ver<span className="sr-only"> pedido {o.orderNumber}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav
        aria-label="Paginación de pedidos"
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-dark-border text-sm text-text-secondary"
      >
        <span aria-live="polite">
          {data ? `${data.total} pedido${data.total === 1 ? '' : 's'} · página ${data.page} de ${data.totalPages}` : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Anterior
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={loading || !data || page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      </nav>

      {creating && (
        <AdminB2bOrderCreateModal
          notify={notify}
          onClose={() => setCreating(false)}
          onCreated={(orderId) => {
            reload();
            setCreating(false);
            setOpenOrderId(orderId);
          }}
        />
      )}
      {openOrderId && (
        <AdminB2bOrderDetailModal
          orderId={openOrderId}
          notify={notify}
          onClose={() => setOpenOrderId(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
