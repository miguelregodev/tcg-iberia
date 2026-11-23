'use client';

/**
 * Read-only order lines + totals breakdown, rendered from the immutable order
 * snapshot (or the server-side pricing preview). Shared by the admin create
 * summary, the admin order detail and the customer order detail.
 */

import type { B2bOrderLineSnapshot, B2bOrderTotals } from '@/types';
import { eurFmt } from './B2bOrderUi';

const pct = (rate: number) => `${Number((rate * 100).toFixed(2)).toLocaleString('es-ES')}%`;

interface B2bOrderLinesTableProps {
  items: B2bOrderLineSnapshot[];
  totals: B2bOrderTotals;
  showImages?: boolean;
}

export function B2bOrderLinesTable({ items, totals, showImages = false }: B2bOrderLinesTableProps) {
  const gross = totals.subtotal + totals.discountTotal;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Productos del pedido</caption>
          <thead className="text-xs uppercase tracking-wider text-text-muted">
            <tr className="border-b border-dark-border">
              <th scope="col" className="py-2 pr-3 text-left">Producto</th>
              <th scope="col" className="py-2 px-2 text-right">Cant.</th>
              <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">P. unit. (sin IVA)</th>
              <th scope="col" className="py-2 px-2 text-right">Dto.</th>
              <th scope="col" className="py-2 px-2 text-right">IVA</th>
              <th scope="col" className="py-2 pl-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {items.map((it, idx) => (
              <tr key={`${it.productId}-${idx}`}>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {showImages && (
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-dark-bg border border-dark-border">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary truncate max-w-[22rem]" title={it.name}>
                        {it.name}
                      </div>
                      {it.sku && <div className="text-xs text-text-muted truncate">Ref. {it.sku}</div>}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono">{it.quantity}</td>
                <td className="py-2 px-2 text-right font-mono">{eurFmt.format(it.unitPriceEur)}</td>
                <td className="py-2 px-2 text-right font-mono">
                  {it.discountPercent ? `${it.discountPercent}%` : '—'}
                </td>
                <td className="py-2 px-2 text-right font-mono">{pct(it.vatRate ?? totals.vatRate)}</td>
                <td className="py-2 pl-2 text-right font-mono font-semibold text-text-primary">
                  {eurFmt.format(it.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        {totals.discountTotal > 0 && (
          <>
            <div className="flex justify-between text-text-secondary">
              <dt>Importe bruto</dt>
              <dd className="font-mono">{eurFmt.format(gross)}</dd>
            </div>
            <div className="flex justify-between text-text-secondary">
              <dt>Descuentos</dt>
              <dd className="font-mono">−{eurFmt.format(totals.discountTotal)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between text-text-secondary">
          <dt>Subtotal productos (sin IVA)</dt>
          <dd className="font-mono">{eurFmt.format(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-text-secondary">
          <dt>Gastos de envío (sin IVA)</dt>
          <dd className="font-mono">{eurFmt.format(totals.shippingCost)}</dd>
        </div>
        <div className="flex justify-between text-text-secondary">
          <dt>IVA {pct(totals.vatRate)}</dt>
          <dd className="font-mono">{eurFmt.format(totals.ivaAmount)}</dd>
        </div>
        {totals.surchargeAmount > 0 && (
          <div className="flex justify-between text-text-secondary">
            <dt>Recargo de Equivalencia {pct(totals.surchargeRate)}</dt>
            <dd className="font-mono">{eurFmt.format(totals.surchargeAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-dark-border pt-2 text-base font-bold">
          <dt className="text-text-primary">Total</dt>
          <dd className="font-mono text-premium-gold">{eurFmt.format(totals.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
