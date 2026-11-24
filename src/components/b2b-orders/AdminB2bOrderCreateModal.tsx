'use client';

/**
 * Admin "create B2B order" flow:
 *   1. search & select a B2B customer (company / email / NIF),
 *   2. search catalog products and build lines (quantity, optional discount),
 *   3. shipping cost + notes,
 *   4. optional automatic document (final invoice vs. preliminary proforma /
 *      quotation — clearly distinguished),
 *   5. review the SERVER-calculated summary (/preview) and create.
 *
 * A per-form idempotency key makes a retried submit return the same order
 * instead of creating a duplicate.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { B2bOrderLineSnapshot } from '@/types';
import {
  Badge,
  Modal,
  Section,
  btnFiscal,
  btnPrimary,
  btnSecondary,
  eurFmt,
  inputClass,
} from './B2bOrderUi';
import { B2bOrderLinesTable } from './B2bOrderLinesTable';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';

/** Mirrors normalizeManualDocumentNumber() in src/lib/b2b/order-numbers.ts (server re-validates). */
const DOCUMENT_NUMBER_RE = /^[A-Z0-9][A-Z0-9-]{2,49}$/;
const DOCUMENT_PREFIX = { INVOICE: 'FAC', PROFORMA: 'PRO', QUOTATION: 'PRES' } as const;

type Notify = (type: 'success' | 'error', message: string) => void;

interface AdminB2bOrderCreateModalProps {
  notify: Notify;
  onClose: () => void;
  onCreated: (orderId: string) => void;
}

interface CustomerOption {
  id: string;
  email: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  companyName: string;
  vatNumber: string;
  contactName: string;
  phone: string;
  billingAddress: string | null;
  shippingAddress: string;
  equivalenceSurcharge: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  language: string;
  imageUrl: string | null;
  stock: number;
  unitPriceEur: number | null;
}

interface DraftLine {
  product: ProductOption;
  quantity: string;
  discountPercent: string;
}

interface PreviewResult {
  items: B2bOrderLineSnapshot[];
  rejections: Array<{ productId: string; reason: 'unavailable' | 'no_price' }>;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  vatRate: number;
  ivaAmount: number;
  surchargeRate: number;
  surchargeAmount: number;
  total: number;
}

type DocumentChoice = 'INVOICE' | 'PROFORMA' | 'QUOTATION';

const DOCUMENT_CHOICES: Array<{ value: DocumentChoice; title: string; description: string }> = [
  {
    value: 'INVOICE',
    title: 'Factura definitiva',
    description: 'Factura con validez fiscal. Debes indicar su número. No se puede anular, solo rectificar.',
  },
  {
    value: 'PROFORMA',
    title: 'Factura proforma',
    description: 'Documento preliminar sin validez fiscal (PRO-) con importes y datos de pago.',
  },
  {
    value: 'QUOTATION',
    title: 'Presupuesto',
    description: 'Documento preliminar sin validez fiscal (PRES-). El pedido queda pendiente de confirmar.',
  },
];

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function AdminB2bOrderCreateModal({ notify, onClose, onCreated }: AdminB2bOrderCreateModalProps) {
  const idempotencyKey = useRef(newIdempotencyKey()).current;

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [shippingCost, setShippingCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [autoDocument, setAutoDocument] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentChoice>('INVOICE');
  const [manualNumbering, setManualNumbering] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load every customer and product once; the selects filter client-side ──
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/b2b/customers', { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { customers: [] }))
      .then((d: { customers: CustomerOption[] }) =>
        setCustomers([...(d.customers ?? [])].sort((a, b) => a.companyName.localeCompare(b.companyName, 'es')))
      )
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setCustomersLoading(false);
      });
    fetch('/api/admin/b2b/products', { signal: controller.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d: { products: ProductOption[] }) => setProducts(d.products ?? []))
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setProductsLoading(false);
      });
    return () => controller.abort();
  }, []);

  const customerOptions = useMemo<SearchableOption<CustomerOption>[]>(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.companyName,
        keywords: `${c.email} ${c.vatNumber} ${c.vatNumber.replace(/[^A-Za-z0-9]/g, '')} ${c.contactName}`,
        disabled: c.status === 'DISABLED',
        data: c,
      })),
    [customers]
  );

  const productOptions = useMemo<SearchableOption<ProductOption>[]>(
    () =>
      products
        .filter((p) => p.unitPriceEur !== null)
        .map((p) => ({
          value: p.id,
          label: p.name,
          keywords: `${p.sku} ${p.language}`,
          data: p,
        })),
    [products]
  );

  const addProduct = (p: ProductOption) => {
    setLines((prev) =>
      prev.some((l) => l.product.id === p.id)
        ? prev.map((l) =>
            l.product.id === p.id ? { ...l, quantity: String(Math.min(999, (Number(l.quantity) || 0) + 1)) } : l
          )
        : [...prev, { product: p, quantity: '1', discountPercent: '' }]
    );
  };

  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));

  const payloadItems = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.product.id,
        quantity: Number(l.quantity),
        discountPercent: l.discountPercent === '' ? 0 : Number(l.discountPercent),
      })),
    [lines]
  );

  // ── Server-side preview (debounced) ─────────────────────────────────────
  useEffect(() => {
    if (lines.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch('/api/admin/b2b/orders/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: payloadItems,
            shippingCost: shippingCost === '' ? 0 : Number(shippingCost),
            customerId: customer?.id,
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPreview(null);
          setPreviewError(data.error ?? 'No se pudo calcular el pedido.');
        } else {
          setPreview(data.pricing as PreviewResult);
          setPreviewError(null);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setPreviewError('No se pudo calcular el pedido.');
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [payloadItems, shippingCost, lines.length, customer?.id]);

  const rejectedNames = (preview?.rejections ?? []).map(
    (r) => `${lines.find((l) => l.product.id === r.productId)?.product.name ?? r.productId} (${r.reason === 'no_price' ? 'sin precio B2B' : 'no disponible'})`
  );

  const documentNumberValid = DOCUMENT_NUMBER_RE.test(documentNumber.trim());
  // Invoices are always numbered by the admin; proformas/quotations may use their series.
  const numberRequired = documentType === 'INVOICE';
  const useManualNumber = autoDocument && (numberRequired || manualNumbering);
  const canSubmit =
    !!customer &&
    customer.status !== 'DISABLED' &&
    lines.length > 0 &&
    !!preview &&
    preview.rejections.length === 0 &&
    !previewError &&
    !previewLoading &&
    !(useManualNumber && !documentNumberValid) &&
    !submitting;

  const submit = async () => {
    if (!customer || !canSubmit) return;
    if (
      autoDocument &&
      documentType === 'INVOICE' &&
      !window.confirm(
        `Se emitirá una FACTURA DEFINITIVA con el número ${documentNumber.trim()} de ${eurFmt.format(preview!.total)} a ${customer.companyName}. Las facturas emitidas no pueden modificarse, solo rectificarse. ¿Continuar?`
      )
    ) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/admin/b2b/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          items: payloadItems,
          shippingCost: shippingCost === '' ? 0 : Number(shippingCost),
          notes,
          internalNotes,
          document: autoDocument ? documentType : 'NONE',
          ...(useManualNumber && { documentNumber: documentNumber.trim() }),
          notifyCustomer: autoDocument && notifyCustomer,
          idempotencyKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? 'No se pudo crear el pedido.');
        return;
      }
      const parts = [`Pedido ${data.order.orderNumber} ${data.duplicate ? 'ya existía (no se ha duplicado)' : 'creado'}.`];
      if (data.document?.status === 'ISSUED') parts.push(`Documento ${data.document.number} emitido.`);
      if (data.email && !data.email.sent) parts.push('El email al cliente no se pudo enviar.');
      if (data.document && data.document.status !== 'ISSUED') {
        notify('error', `${parts.join(' ')} El documento no se pudo generar: ${data.document.error ?? 'error desconocido'}. Puedes reintentarlo desde el pedido.`);
      } else {
        notify('success', parts.join(' '));
      }
      onCreated(data.order.id);
    } catch {
      setSubmitError('Error de red. Puedes reintentar: el pedido no se duplicará.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = !autoDocument
    ? 'Crear pedido'
    : documentType === 'INVOICE'
      ? 'Crear pedido y emitir factura'
      : documentType === 'PROFORMA'
        ? 'Crear pedido y generar proforma'
        : 'Crear pedido y generar presupuesto';

  return (
    <Modal
      title="Nuevo pedido B2B"
      subtitle="Los precios, el IVA y los totales se calculan en el servidor con las tarifas B2B vigentes."
      onClose={onClose}
      wide
      footer={
        <>
          {submitError && (
            <p role="alert" className="mr-auto text-sm text-danger self-center">
              {submitError}
            </p>
          )}
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className={autoDocument && documentType === 'INVOICE' ? btnFiscal : btnPrimary}
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? 'Creando…' : submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 1. Customer */}
        <Section title="1. Cliente">
          {customer ? (
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <div className="font-semibold text-text-primary">{customer.companyName}</div>
                <div className="text-text-secondary">NIF/CIF: {customer.vatNumber}</div>
                {customer.equivalenceSurcharge && (
                  <div className="mt-1">
                    <Badge className="bg-premium-gold/15 text-premium-gold">Recargo de Equivalencia 5,2%</Badge>
                  </div>
                )}
                <div className="text-text-secondary">{customer.contactName}</div>
                <div className="text-text-secondary">{customer.email} · {customer.phone}</div>
                {customer.status !== 'ACTIVE' && (
                  <div className="mt-1">
                    <Badge className={customer.status === 'DISABLED' ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}>
                      {customer.status === 'DISABLED' ? 'Cuenta desactivada' : 'Pendiente de activación'}
                    </Badge>
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase text-text-muted mb-1">Facturación</div>
                <div className="text-text-secondary whitespace-pre-line">{customer.billingAddress || customer.shippingAddress}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-text-muted mb-1">Envío</div>
                <div className="text-text-secondary whitespace-pre-line">{customer.shippingAddress}</div>
                <button type="button" className={`${btnSecondary} mt-2`} onClick={() => setCustomer(null)}>
                  Cambiar cliente
                </button>
              </div>
            </div>
          ) : (
            <SearchableSelect
              id="b2b-create-customer"
              label="Cliente"
              hint="Despliega la lista o escribe para filtrar por empresa, email, NIF/CIF o contacto."
              placeholder="Selecciona o busca…"
              options={customerOptions}
              loading={customersLoading}
              emptyMessage="Ningún cliente coincide"
              onSelect={(o) => setCustomer(o.data)}
              renderOption={(o) => (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-text-primary">{o.data.companyName}</span>
                  <span className="text-xs text-text-secondary">
                    {o.data.email} · {o.data.vatNumber}
                  </span>
                  {o.data.status === 'DISABLED' && <span className="text-xs text-danger">(desactivado)</span>}
                  {o.data.status === 'PENDING' && <span className="text-xs text-warning">(pendiente de activación)</span>}
                </span>
              )}
            />
          )}
        </Section>

        {/* 2. Products */}
        <Section title="2. Productos">
          <SearchableSelect
            id="b2b-create-product"
            label="Añadir producto"
            hint="Solo se muestran productos con precio B2B. Escribe para filtrar por nombre o referencia."
            placeholder="Selecciona o busca…"
            options={productOptions}
            loading={productsLoading}
            emptyMessage="Ningún producto con precio B2B coincide"
            onSelect={(o) => addProduct(o.data)}
            renderOption={(o) => (
              <span className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{o.data.name}</span>
                  <span className="block text-xs text-text-muted truncate">
                    Ref. {o.data.sku} · Stock {o.data.stock}
                    {lines.some((l) => l.product.id === o.value) && ' · ya añadido (+1)'}
                  </span>
                </span>
                <span className="text-sm font-mono text-text-primary whitespace-nowrap">
                  {eurFmt.format(o.data.unitPriceEur ?? 0)} + IVA
                </span>
              </span>
            )}
          />

          {lines.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Líneas del pedido</caption>
                <thead className="text-xs uppercase tracking-wider text-text-muted">
                  <tr>
                    <th scope="col" className="py-2 text-left">Producto</th>
                    <th scope="col" className="py-2 px-2 text-right">P. unit.</th>
                    <th scope="col" className="py-2 px-2 text-right">Cantidad</th>
                    <th scope="col" className="py-2 px-2 text-right">Dto. %</th>
                    <th scope="col" className="py-2"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {lines.map((l) => (
                    <tr key={l.product.id}>
                      <td className="py-2 pr-2">
                        <div className="text-text-primary truncate max-w-[24rem]">{l.product.name}</div>
                        <div className="text-xs text-text-muted">Ref. {l.product.sku}</div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-text-secondary">
                        {l.product.unitPriceEur === null ? '—' : eurFmt.format(l.product.unitPriceEur)}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <label className="sr-only" htmlFor={`qty-${l.product.id}`}>Cantidad de {l.product.name}</label>
                        <input
                          id={`qty-${l.product.id}`}
                          type="number"
                          min={1}
                          max={999}
                          step={1}
                          inputMode="numeric"
                          className={`${inputClass} w-24 text-right`}
                          value={l.quantity}
                          onChange={(e) => updateLine(l.product.id, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <label className="sr-only" htmlFor={`dto-${l.product.id}`}>Descuento de {l.product.name}</label>
                        <input
                          id={`dto-${l.product.id}`}
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          inputMode="decimal"
                          placeholder="0"
                          className={`${inputClass} w-24 text-right`}
                          value={l.discountPercent}
                          onChange={(e) => updateLine(l.product.id, { discountPercent: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <button
                          type="button"
                          className="text-text-muted hover:text-danger px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger rounded"
                          onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
                          aria-label={`Quitar ${l.product.name}`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* 3. Shipping & notes */}
        <Section title="3. Envío y notas">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="b2b-create-shipping" className="block text-xs text-text-secondary mb-1">
                Gastos de envío (€ sin IVA)
              </label>
              <input
                id="b2b-create-shipping"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                className={inputClass}
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="b2b-create-notes" className="block text-xs text-text-secondary mb-1">
                Notas visibles para el cliente
              </label>
              <textarea id="b2b-create-notes" rows={3} maxLength={2000} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div>
              <label htmlFor="b2b-create-internal" className="block text-xs text-text-secondary mb-1">
                Notas internas (solo administradores)
              </label>
              <textarea id="b2b-create-internal" rows={3} maxLength={5000} className={inputClass} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
            </div>
          </div>
        </Section>

        {/* 4. Document */}
        <Section title="4. Documento">
          <div className="flex items-center gap-2">
            <input
              id="b2b-create-autodoc"
              type="checkbox"
              checked={autoDocument}
              onChange={(e) => setAutoDocument(e.target.checked)}
              className="h-4 w-4 accent-premium-gold"
            />
            <label htmlFor="b2b-create-autodoc" className="text-sm text-text-primary">
              Generar documento automáticamente
            </label>
          </div>
          {!autoDocument && (
            <p className="mt-2 text-xs text-text-secondary">
              Se creará solo el pedido. Podrás emitir la factura, proforma o presupuesto más tarde desde el detalle.
            </p>
          )}
          {autoDocument && (
            <fieldset className="mt-3 grid gap-2 md:grid-cols-3">
              <legend className="sr-only">Tipo de documento</legend>
              {DOCUMENT_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className={`block cursor-pointer rounded-lg border p-3 text-sm ${
                    documentType === c.value
                      ? c.value === 'INVOICE'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-premium-gold bg-premium-gold/10'
                      : 'border-dark-border hover:bg-dark-surfaceHover'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="b2b-doc-type"
                      value={c.value}
                      checked={documentType === c.value}
                      onChange={() => setDocumentType(c.value)}
                      className="accent-premium-gold"
                    />
                    <span className="font-semibold text-text-primary">{c.title}</span>
                    {c.value === 'INVOICE' ? (
                      <Badge className="bg-red-500/15 text-red-300">Fiscal</Badge>
                    ) : (
                      <Badge className="bg-dark-bg text-text-muted">Preliminar</Badge>
                    )}
                  </span>
                  <span className="block mt-1 text-xs text-text-secondary">{c.description}</span>
                </label>
              ))}
              <div className="md:col-span-3 mt-2 rounded-lg border border-dark-border p-3">
                <fieldset>
                  <legend className="text-sm font-medium text-text-primary">
                    Número {documentType === 'INVOICE' ? 'de factura' : documentType === 'PROFORMA' ? 'de proforma' : 'de presupuesto'}
                  </legend>
                  {numberRequired ? (
                    <p className="mt-1 text-xs text-text-secondary">
                      Las facturas se numeran siempre manualmente con el número de tu contabilidad.
                    </p>
                  ) : (
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2 text-text-primary">
                      <input
                        type="radio"
                        name="b2b-doc-numbering"
                        checked={!manualNumbering}
                        onChange={() => setManualNumbering(false)}
                        className="accent-premium-gold"
                      />
                      Automático (siguiente de la serie {DOCUMENT_PREFIX[documentType]}-)
                    </label>
                    <label className="flex items-center gap-2 text-text-primary">
                      <input
                        type="radio"
                        name="b2b-doc-numbering"
                        checked={manualNumbering}
                        onChange={() => setManualNumbering(true)}
                        className="accent-premium-gold"
                      />
                      Manual
                    </label>
                  </div>
                  )}
                </fieldset>
                {(numberRequired || manualNumbering) && (
                  <div className="mt-3 max-w-sm">
                    <label htmlFor="b2b-create-docnumber" className="block text-xs text-text-secondary mb-1">
                      {numberRequired ? 'Número de factura *' : 'Número del documento *'}
                    </label>
                    <input
                      id="b2b-create-docnumber"
                      type="text"
                      autoComplete="off"
                      maxLength={50}
                      className={`${inputClass} font-mono uppercase`}
                      placeholder={numberRequired ? 'Ej. FAC-2026-000123' : `${DOCUMENT_PREFIX[documentType]}-${new Date().getFullYear()}-000123`}
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
                      aria-invalid={documentNumber !== '' && !documentNumberValid}
                      aria-describedby="b2b-create-docnumber-help"
                    />
                    <p
                      id="b2b-create-docnumber-help"
                      className={`mt-1 text-xs ${documentNumber !== '' && !documentNumberValid ? 'text-danger' : 'text-text-secondary'}`}
                    >
                      Letras, números y guiones (3-50 caracteres). Debe ser único.
                    </p>
                  </div>
                )}
              </div>
              <div className="md:col-span-3 flex items-center gap-2 mt-1">
                <input
                  id="b2b-create-notify"
                  type="checkbox"
                  checked={notifyCustomer}
                  onChange={(e) => setNotifyCustomer(e.target.checked)}
                  className="h-4 w-4 accent-premium-gold"
                />
                <label htmlFor="b2b-create-notify" className="text-sm text-text-primary">
                  Enviar el documento al cliente por email
                </label>
              </div>
            </fieldset>
          )}
        </Section>

        {/* 5. Summary */}
        <Section title="5. Resumen (calculado en el servidor)">
          <div aria-live="polite">
            {lines.length === 0 && <p className="text-sm text-text-muted">Añade productos para ver el resumen.</p>}
            {previewLoading && <p className="text-sm text-text-muted">Calculando…</p>}
            {previewError && (
              <p role="alert" className="text-sm text-danger">
                {previewError}
              </p>
            )}
            {rejectedNames.length > 0 && (
              <p role="alert" className="text-sm text-danger mb-2">
                No se pueden pedir: {rejectedNames.join(', ')}. Quítalos para continuar.
              </p>
            )}
          </div>
          {preview && preview.items.length > 0 && !previewError && (
            <B2bOrderLinesTable items={preview.items} totals={preview} />
          )}
        </Section>
      </div>
    </Modal>
  );
}
