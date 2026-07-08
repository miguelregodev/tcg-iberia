'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminNav } from '@/components/AdminNav';
import { PriceUpdateModal, type ModalRow } from '@/components/PriceUpdateModal';
import { ProductAutocomplete, type CatalogProduct } from '@/components/ProductAutocomplete';
import { ProductForm } from '@/components/ProductForm';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import { convertJpyToEur, computeSellingPrice } from '@/lib/price-import/currency';
import type { ImportedRow } from '@/app/api/admin/price-import/sheets/route';
import type { Product } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type PriceVariant = 'SHRINK' | 'NO_SHRINK';

/** `${sheetProductName}:${variant}` — matches the server-side history key. */
function historyKey(sheetProductName: string, variant: PriceVariant): string {
  return `${sheetProductName}:${variant}`;
}

/** Left → Shrink, Right → No Shrink. Mirrors the sheets parser convention. */
function variantFromSourceGroup(group: 'left' | 'right'): PriceVariant {
  return group === 'left' ? 'SHRINK' : 'NO_SHRINK';
}

interface TableRow extends ImportedRow {
  /** Client-side unique key for React rendering */
  key: string;
  priceUpdated: boolean;
  updatedPrice: number | null;
}

interface CreateFromRow {
  rowKey: string;
  importedName: string;
  suggestedPrice: number;
  suggestedNoShrinkPrice: number | null;
}

type NotificationType = 'success' | 'error';

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const eur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });

// ── Helper components ─────────────────────────────────────────────────────────

function StatusBadge({ row }: { row: TableRow }) {
  if (row.priceUpdated) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        ✔ Actualizado
      </span>
    );
  }
  if (row.matchedProductId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
        ✅ {row.matchSource === 'manual' ? 'Manual' : `Automático ${row.matchScore ? `(${Math.round(row.matchScore * 100)}%)` : ''}`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      ⚠ Sin asignar
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PriceImportPage() {
  const [sheetsUrl, setSheetsUrl] = useState(
    process.env.NEXT_PUBLIC_PRICE_IMPORT_SHEET_URL ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [rows, setRows] = useState<TableRow[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateSource, setExchangeRateSource] = useState<string>('');

  const [modalRow, setModalRow] = useState<ModalRow | null>(null);
  const [createFromRow, setCreateFromRow] = useState<CreateFromRow | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifCounter = useRef(0);

  const [savingMappingKey, setSavingMappingKey] = useState<string | null>(null);

  /**
   * Keys `${productId}:${variant}` for which the just-imported purchase price
   * is the all-time historical minimum. Populated from the response of the
   * history-recording endpoint after every successful import.
   */
  const [historicalMinKeys, setHistoricalMinKeys] = useState<Set<string>>(new Set());
  /**
   * Bumped after every successful import so the price-history chart re-fetches
   * its currently-selected series (in case today's data was just added).
   */
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // ── Load product catalog once ───────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/products')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: CatalogProduct[]) => setProducts(data))
      .catch(() => {/* non-fatal: autocomplete just won't show products */});
  }, []);

  // ── Toast notifications ─────────────────────────────────────────────────────
  const pushNotification = useCallback((type: NotificationType, message: string) => {
    const id = ++notifCounter.current;
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  /**
   * Persist the imported prices into the historical database and refresh the
   * per-variant "historical minimum" flags used to render the star icon.
   *
   * ALL imported rows are persisted (matched or not) — history is keyed by the
   * imported sheet name, so the historical price series stays intact even for
   * rows that have not yet been linked to a catalog product.
   */
  const recordHistoryForRows = useCallback(
    async (tableRows: TableRow[], rate: number) => {
      const entries = tableRows
        .filter((r) => r.importedName && r.jpyPrice > 0)
        .map((r) => ({
          catalogProductId: r.matchedProductId ?? null,
          variant: variantFromSourceGroup(r.sourceGroup),
          sheetProductName: r.importedName,
          priceJpy: r.jpyPrice,
        }));

      if (entries.length === 0) {
        setHistoricalMinKeys(new Set());
        setHistoryRefreshKey((k) => k + 1);
        return;
      }

      try {
        const res = await fetch('/api/admin/price-import/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchangeRate: rate, entries }),
        });
        if (!res.ok) return; // Non-fatal: keep table interactive.

        const data = (await res.json()) as {
          results: Array<{ key: string; isHistoricalMin: boolean }>;
        };
        const mins = new Set(
          data.results.filter((r) => r.isHistoricalMin).map((r) => r.key)
        );
        setHistoricalMinKeys(mins);
        setHistoryRefreshKey((k) => k + 1);
      } catch {
        // Non-fatal — leave existing star state as-is.
      }
    },
    []
  );

  // ── Import handler ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    const url = sheetsUrl.trim();
    if (!url) {
      setImportError('Introduce la URL de Google Sheets.');
      return;
    }

    setLoading(true);
    setImportError(null);
    setRows([]);
    setHistoricalMinKeys(new Set());

    try {
      // Fetch exchange rate and sheet data in parallel
      const [rateRes, sheetsRes] = await Promise.all([
        fetch('/api/admin/price-import/exchange-rate'),
        fetch('/api/admin/price-import/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        }),
      ]);

      if (!rateRes.ok) {
        const data = await rateRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al obtener la tasa de cambio.');
      }

      if (!sheetsRes.ok) {
        const data = await sheetsRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al leer la hoja de cálculo.');
      }

      const rateData: { rate: number; source: string } = await rateRes.json();
      const sheetsData: { items: ImportedRow[] } = await sheetsRes.json();

      setExchangeRate(rateData.rate);
      setExchangeRateSource(rateData.source);

      const tableRows: TableRow[] = sheetsData.items.map((item, index) => ({
        ...item,
        key: `${item.sourceGroup}-${item.sourceRow}-${index}`,
        priceUpdated: false,
        updatedPrice: null,
      }));

      setRows(tableRows);

      if (tableRows.length === 0) {
        setImportError('No se encontraron productos en las filas 15–52 del documento.');
      } else {
        // Record historical prices for matched rows and update star icons.
        // Fire-and-forget: import UI stays usable even if history save fails.
        void recordHistoryForRows(tableRows, rateData.rate);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido durante la importación.';
      setImportError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Manual product assignment ───────────────────────────────────────────────
  const handleManualAssign = useCallback(
    async (rowKey: string, importedName: string, productId: string, productName: string) => {
      setSavingMappingKey(rowKey);
      try {
        const res = await fetch('/api/admin/price-import/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ importedName, productId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'No se pudo guardar el mapeo.');
        }

        setRows((prev) =>
          prev.map((r) =>
            r.key === rowKey
              ? {
                  ...r,
                  matchedProductId: productId,
                  matchedProductName: productName,
                  matchScore: 1.0,
                  matchSource: 'manual',
                }
              : r
          )
        );
        pushNotification('success', `Mapeo guardado: "${importedName}" → "${productName}"`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al guardar mapeo.';
        pushNotification('error', message);
      } finally {
        setSavingMappingKey(null);
      }
    },
    [pushNotification]
  );

  // ── Open create-product modal for an unmatched row ─────────────────────────
  const handleOpenCreateProduct = useCallback(
    (row: TableRow) => {
      if (!exchangeRate) return;
      const eurCost = convertJpyToEur(row.jpyPrice, exchangeRate);
      const suggestedPrice = computeSellingPrice(eurCost, 25);

      let suggestedNoShrinkPrice: number | null = null;
      if (row.correspondingRightJpyPrice) {
        const rightEurCost = convertJpyToEur(row.correspondingRightJpyPrice, exchangeRate);
        suggestedNoShrinkPrice = computeSellingPrice(rightEurCost, 25);
      }

      setCreateFromRow({ rowKey: row.key, importedName: row.importedName, suggestedPrice, suggestedNoShrinkPrice });
    },
    [exchangeRate]
  );

  // ── Handle successful product creation ─────────────────────────────────────
  const handleProductCreated = useCallback(
    async (savedProduct?: Product) => {
      if (!savedProduct || !createFromRow) {
        setCreateFromRow(null);
        return;
      }

      // Persist the mapping so future imports resolve automatically
      try {
        await fetch('/api/admin/price-import/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            importedName: createFromRow.importedName,
            productId: savedProduct.id,
          }),
        });
      } catch {
        // Non-fatal — mapping save failure doesn't block UI update
      }

      // Update the row to show the newly created product as matched
      setRows((prev) =>
        prev.map((r) =>
          r.key === createFromRow.rowKey
            ? {
                ...r,
                matchedProductId: savedProduct.id,
                matchedProductName: savedProduct.name,
                matchScore: 1.0,
                matchSource: 'manual',
              }
            : r
        )
      );

      // Keep the catalog list fresh for autocomplete
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === savedProduct.id);
        if (exists) return prev;
        return [...prev, { id: savedProduct.id, name: savedProduct.name }].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });

      pushNotification('success', `Producto creado y asignado: "${savedProduct.name}"`);
      setCreateFromRow(null);
    },
    [createFromRow, pushNotification]
  );

  // ── Open price update modal ─────────────────────────────────────────────────
  const handleOpenModal = useCallback((row: TableRow) => {
    if (!row.matchedProductId || !row.matchedProductName) return;
    setModalRow({
      importedName: row.importedName,
      jpyPrice: row.jpyPrice,
      matchedProductId: row.matchedProductId,
      matchedProductName: row.matchedProductName,
    });
  }, []);

  // ── Confirm price update ────────────────────────────────────────────────────
  const handleConfirmPrice = useCallback(
    async (productId: string, finalPrice: number) => {
      const res = await fetch('/api/admin/price-import/update-price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, price: finalPrice }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'No se pudo actualizar el precio.');
      }

      const updated = await res.json();

      setRows((prev) =>
        prev.map((r) =>
          r.matchedProductId === productId
            ? { ...r, priceUpdated: true, updatedPrice: updated.price }
            : r
        )
      );

      pushNotification(
        'success',
        `Precio actualizado: "${updated.name}" → ${eur.format(updated.price)}`
      );
      setModalRow(null);
    },
    [pushNotification]
  );

  // ── Derived stats ───────────────────────────────────────────────────────────
  const stats = {
    total: rows.length,
    matched: rows.filter((r) => r.matchedProductId).length,
    unmatched: rows.filter((r) => !r.matchedProductId).length,
    updated: rows.filter((r) => r.priceUpdated).length,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg animate-slideUp ${
              n.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {n.type === 'success' ? '✓ ' : '✕ '}
            {n.message}
          </div>
        ))}
      </div>

      <div className="container-custom px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Administración de Precios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Importa precios desde Google Sheets y actualiza el catálogo de productos.
          </p>
        </div>

        {/* Import form */}
        <div className="rounded-2xl bg-white border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Importar desde Google Sheets</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleImport(); }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={handleImport}
              disabled={loading || !sheetsUrl.trim()}
              className="btn btn-primary text-sm whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Cargando…
                </span>
              ) : (
                'Cargar precios'
              )}
            </button>
          </div>

          {importError && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {importError}
            </div>
          )}

          {/* Exchange rate info */}
          {exchangeRate !== null && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                Tasa de cambio:{' '}
                <strong className="text-gray-700">1 JPY = {exchangeRate.toFixed(6)} EUR</strong>
              </span>
              <span>Fuente: {exchangeRateSource}</span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total importados', value: stats.total, color: 'text-gray-800' },
              { label: 'Productos coincidentes', value: stats.matched, color: 'text-blue-700' },
              { label: 'Sin asignar', value: stats.unmatched, color: 'text-amber-700' },
              { label: 'Precios actualizados', value: stats.updated, color: 'text-green-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b border-gray-50 last:border-b-0">
                <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Results table */}
        {!loading && rows.length > 0 && (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Producto importado
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Precio JPY
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Precio compra (EUR)
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      P. sugerido (+25%)
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      PVP actual
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Producto en catálogo
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const eurCost = exchangeRate ? convertJpyToEur(row.jpyPrice, exchangeRate) : null;
                    const suggested = eurCost ? computeSellingPrice(eurCost, 25) : null;
                    const isAssigning = savingMappingKey === row.key;

                    // Star indicator: matches the (sheetProductName, variant)
                    // key emitted by the history API — works for both matched
                    // and unmatched rows since history is keyed by imported name.
                    const rowVariant = variantFromSourceGroup(row.sourceGroup);
                    const isHistoricalMin = historicalMinKeys.has(
                      historyKey(row.importedName, rowVariant)
                    );

                    return (
                      <tr
                        key={row.key}
                        className={`transition-colors hover:bg-gray-50 ${
                          row.priceUpdated ? 'bg-green-50/50' : ''
                        }`}
                      >
                        {/* Imported name */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 max-w-[200px] truncate" title={row.importedName}>
                            {row.importedName}
                          </div>
                          <div className="text-xs text-gray-400">
                            Fila {row.sourceRow} · {row.sourceGroup === 'left' ? 'Izquierda' : 'Derecha'}
                          </div>
                        </td>

                        {/* JPY price */}
                        <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
                          {jpyFmt.format(row.jpyPrice)}
                        </td>

                        {/* Purchase price EUR (JPY → EUR, pre-margin) — star = all-time historical minimum */}
                        <td className="px-4 py-3 text-right font-mono text-blue-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {isHistoricalMin && (
                              <span
                                className="text-amber-400 text-base leading-none"
                                title="Mínimo histórico de precio de compra para esta variante"
                                aria-label="Mínimo histórico"
                              >
                                ★
                              </span>
                            )}
                            <span>{eurCost !== null ? eur.format(eurCost) : '—'}</span>
                          </span>
                        </td>

                        {/* Suggested price */}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800 whitespace-nowrap">
                          {suggested !== null ? eur.format(suggested) : '—'}
                        </td>

                        {/* Actual PVP price in catalog */}
                        <td className="px-4 py-3 text-right font-mono text-green-700 whitespace-nowrap">
                          {row.matchedProductId
                            ? (() => {
                                const matchedProduct = products.find((p) => p.id === row.matchedProductId);
                                return matchedProduct?.price ? eur.format(matchedProduct.price) : '—';
                              })()
                            : '—'}
                        </td>

                        {/* Catalog product / autocomplete */}
                        <td className="px-4 py-3 min-w-[220px]">
                          {row.matchedProductId ? (
                            <div>
                              <div
                                className="font-medium text-gray-900 max-w-[220px] truncate"
                                title={row.matchedProductName ?? ''}
                              >
                                {row.matchedProductName}
                              </div>
                              {row.matchSource === 'fuzzy' && row.matchScore !== null && (
                                <div className="text-xs text-gray-400">
                                  Similitud: {Math.round(row.matchScore * 100)}%
                                </div>
                              )}
                              {row.matchSource === 'manual' && (
                                <div className="text-xs text-gray-400">Asignado manualmente</div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 text-base">⚠</span>
                              <ProductAutocomplete
                                products={products}
                                value={null}
                                onChange={(pid, pname) =>
                                  handleManualAssign(row.key, row.importedName, pid, pname)
                                }
                                placeholder="Sin producto asignado"
                                disabled={isAssigning}
                              />
                              {isAssigning && (
                                <span className="h-4 w-4 rounded-full border-2 border-red-500 border-t-transparent animate-spin flex-shrink-0" />
                              )}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge row={row} />
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.matchedProductId ? (
                            <button
                              onClick={() => handleOpenModal(row)}
                              disabled={row.priceUpdated}
                              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                                row.priceUpdated
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700'
                              }`}
                            >
                              {row.priceUpdated ? 'Actualizado' : 'Actualizar precio'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenCreateProduct(row)}
                              disabled={!exchangeRate}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              + Crear producto
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
              {rows.length} productos importados · Tasa: 1 JPY = {exchangeRate?.toFixed(6) ?? '…'} EUR
            </div>
          </div>
        )}

        {/* Historical price chart — independent of the import table; always visible */}
        <div className="mt-8">
          <PriceHistoryChart refreshKey={historyRefreshKey} />
        </div>
      </div>

      {/* Price update modal */}
      <PriceUpdateModal
        isOpen={!!modalRow}
        onClose={() => setModalRow(null)}
        onConfirm={handleConfirmPrice}
        row={modalRow}
        exchangeRate={exchangeRate ?? 0}
      />

      {/* Create new product modal */}
      {createFromRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto px-4 py-8">
          <div className="w-full max-w-4xl">
            {/* Header bar */}
            <div className="flex items-center justify-between rounded-t-2xl bg-white border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Crear nuevo producto</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Producto importado: <span className="font-medium text-gray-700">{createFromRow.importedName}</span>
                </p>
              </div>
              <button
                onClick={() => setCreateFromRow(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-semibold leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <div className="rounded-b-2xl bg-gray-50 px-6 py-6">
              <ProductForm
                initialData={{
                  name: createFromRow.importedName,
                  price: createFromRow.suggestedPrice,
                  noShrinkPrice: createFromRow.suggestedNoShrinkPrice ?? undefined,
                  language: 'JAPANESE',
                }}
                onSuccess={handleProductCreated}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
