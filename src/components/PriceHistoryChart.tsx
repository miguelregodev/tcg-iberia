'use client';

/**
 * PriceHistoryChart
 *
 * Interactive SVG line chart that visualizes the historical purchase-price
 * evolution (JPY → EUR, pre-margin) of all products, with separate series
 * for each product variant (SHRINK, NO_SHRINK).
 *
 * Design goals:
 *  - Zero external dependencies (no chart library) → implemented as a plain
 *    SVG that scales via `viewBox` for responsive rendering.
 *  - Multiple colored lines, one per product.
 *  - Smooth cubic-bezier connections between data points.
 *  - Gaps in the timeline (days with no import) are handled by drawing a
 *    direct segment between consecutive available points — no artificial
 *    interpolation is generated.
 *  - Hover interaction reveals a tooltip with the exact date, EUR purchase
 *    price, original JPY price, exchange rate, and product name.
 *  - Variant selector (SHRINK / NO_SHRINK) filters the displayed series.
 *  - Legend showing product colors.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type ChartVariant = 'SHRINK' | 'NO_SHRINK';

interface ChartPoint {
  date: string; // YYYY-MM-DD
  purchasePriceEur: number;
  priceJpy: number;
  exchangeRate: number;
}

interface ProductSeries {
  productId: string;
  productName: string;
  points: ChartPoint[];
}

interface Props {
  refreshKey?: number;
}

// ── Color palette for products ──────────────────────────────────────────────

const PRODUCT_COLORS = [
  '#dc2626', // red-600
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#e11d48', // rose-600
  '#ea580c', // orange-600
];

function getProductColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
}

// ── Formatters ───────────────────────────────────────────────────────────────

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const jpyFmt = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

// ── Chart geometry ───────────────────────────────────────────────────────────

const CHART_W = 900;
const CHART_H = 360;
const PAD = { top: 24, right: 24, bottom: 44, left: 64 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDateUtc(iso: string): number {
  // Parse YYYY-MM-DD as a UTC midnight timestamp to avoid TZ off-by-one.
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Build a smooth cubic-bezier path connecting the given screen-space points.
 * Uses the Catmull-Rom → Bezier conversion so the curve passes through every
 * point (no overshoot beyond adjacent extrema for typical monotonic series).
 */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const segments = [`M ${points[0].x} ${points[0].y}`];
  const smoothing = 0.2;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) * smoothing;
    const cp1y = p1.y + (p2.y - p0.y) * smoothing;
    const cp2x = p2.x - (p3.x - p1.x) * smoothing;
    const cp2y = p2.y - (p3.y - p1.y) * smoothing;

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return segments.join(' ');
}

/** Choose ~5 evenly-spaced tick indices for a series of length n. */
function pickTickIndices(n: number, target = 5): number[] {
  if (n <= target) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (target - 1);
  const out: number[] = [];
  for (let i = 0; i < target; i++) out.push(Math.round(i * step));
  return Array.from(new Set(out));
}

// ── Component ────────────────────────────────────────────────────────────────

export function PriceHistoryChart({ refreshKey = 0 }: Props) {
  const [variant, setVariant] = useState<ChartVariant>('SHRINK');
  const [products, setProducts] = useState<ProductSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<{
    productIndex: number;
    pointIndex: number;
  } | null>(null);
  /**
   * Product IDs the admin has hidden via the legend. Hidden products are
   * excluded from projection, rendering, and hover snapping so the chart can
   * be filtered down to a subset without losing the underlying data.
   */
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(new Set());
  /**
   * Whether to render the per-point dots on every line by default. Independent
   * of the per-product visibility filter — controlled by the "Mostrar puntos"
   * toggle below the chart.
   */
  const [showDots, setShowDots] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Fetch series whenever the variant changes ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHoverState(null);
    // Reset filter when swapping variants — the set of products changes.
    setHiddenProducts(new Set());

    fetch(`/api/admin/price-import/history/chart?variant=${variant}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'No se pudo cargar el histórico.');
        }
        return res.json() as Promise<{ products: ProductSeries[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar el histórico.');
        setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [variant, refreshKey]);

  /**
   * Toggle a product's visibility in the chart. Called by the legend items.
   * Hides the tooltip when the currently-hovered product is being hidden.
   */
  const toggleProduct = useCallback(
    (productId: string) => {
      setHiddenProducts((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      setHoverState(null);
    },
    []
  );

  // Products actually rendered on the chart (after applying the legend filter).
  const visibleProducts = useMemo(
    () => products.filter((p) => !hiddenProducts.has(p.productId)),
    [products, hiddenProducts]
  );

  // ── Screen-space projection for all VISIBLE series ────────────────────────
  const projection = useMemo(() => {
    if (visibleProducts.length === 0 || visibleProducts.every((p) => p.points.length === 0)) {
      return null;
    }

    // Collect all times and values across all series
    const allTimes: number[] = [];
    const allValues: number[] = [];

    for (const series of visibleProducts) {
      for (const point of series.points) {
        allTimes.push(parseDateUtc(point.date));
        allValues.push(point.purchasePriceEur);
      }
    }

    if (allTimes.length === 0) return null;

    const tMin = Math.min(...allTimes);
    const tMax = Math.max(...allTimes);
    const tSpan = Math.max(1, tMax - tMin);

    let vMin = Math.min(...allValues);
    let vMax = Math.max(...allValues);

    if (vMin === vMax) {
      // Single unique value: still render a horizontal line centered vertically.
      vMin = vMin - Math.max(1, vMin * 0.05);
      vMax = vMax + Math.max(1, vMax * 0.05);
    } else {
      const pad = (vMax - vMin) * 0.1;
      vMin -= pad;
      vMax += pad;
    }
    const vSpan = Math.max(0.0001, vMax - vMin);

    // Project each visible series independently
    const projectedSeries = visibleProducts.map((series) =>
      series.points.map((p) => {
        const x =
          series.points.length === 1
            ? PAD.left + INNER_W / 2
            : PAD.left + ((parseDateUtc(p.date) - tMin) / tSpan) * INNER_W;
        const y = PAD.top + (1 - (p.purchasePriceEur - vMin) / vSpan) * INNER_H;
        return { x, y };
      })
    );

    return { projectedSeries, tMin, tMax, vMin, vMax };
  }, [visibleProducts]);

  // ── Hover handling: snap to the single nearest (product, point) pair ──────
  //     Only ONE marker will be visible at any time — the point closest to the
  //     cursor across all visible series.
  const handleMouseMove = useCallback(
    (evt: React.MouseEvent<SVGSVGElement>) => {
      if (!projection || !svgRef.current) return;
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      // Convert screen coords → viewBox coords
      const vbX = ((evt.clientX - rect.left) / rect.width) * CHART_W;
      const vbY = ((evt.clientY - rect.top) / rect.height) * CHART_H;

      let bestDist = Infinity;
      let bestProductIdx = 0;
      let bestPointIdx = 0;

      for (let i = 0; i < projection.projectedSeries.length; i++) {
        const series = projection.projectedSeries[i];
        for (let j = 0; j < series.length; j++) {
          // Use 2D distance so hovering close to a specific product's line
          // wins over other products' points that happen to share the same
          // x-column. This guarantees the tooltip always tracks the visually
          // closest single point.
          const dx = series[j].x - vbX;
          const dy = series[j].y - vbY;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            bestProductIdx = i;
            bestPointIdx = j;
          }
        }
      }

      setHoverState({ productIndex: bestProductIdx, pointIndex: bestPointIdx });
    },
    [projection]
  );

  const handleMouseLeave = useCallback(() => setHoverState(null), []);

  // ── Y-axis ticks (5 evenly spaced values) ────────────────────────────────
  const yTicks = useMemo(() => {
    if (!projection) return [] as Array<{ value: number; y: number }>;
    const { vMin, vMax } = projection;
    const count = 5;
    const step = (vMax - vMin) / (count - 1);
    return Array.from({ length: count }, (_, i) => {
      const value = vMin + step * i;
      const y = PAD.top + (1 - (value - vMin) / (vMax - vMin)) * INNER_H;
      return { value, y };
    });
  }, [projection]);

  // ── X-axis ticks (all unique dates across visible series) ─────────────────
  const xTicks = useMemo(() => {
    if (!projection || visibleProducts.length === 0)
      return [] as Array<{ label: string; x: number }>;

    // Collect all unique dates
    const allDates = new Set<string>();
    for (const series of visibleProducts) {
      for (const point of series.points) {
        allDates.add(point.date);
      }
    }

    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return [];

    // Pick ~6 evenly-spaced dates for labels
    const indices = pickTickIndices(sortedDates.length, Math.min(6, sortedDates.length));
    return indices.map((i) => {
      const date = sortedDates[i];
      // Find the x position from the first series that has this date
      let x = PAD.left + INNER_W / 2;
      for (let p = 0; p < visibleProducts.length; p++) {
        const idx = visibleProducts[p].points.findIndex((pt) => pt.date === date);
        if (idx !== -1 && projection.projectedSeries[p][idx]) {
          x = projection.projectedSeries[p][idx].x;
          break;
        }
      }

      return {
        label: dateFmt.format(new Date(parseDateUtc(date))),
        x,
      };
    });
  }, [projection, visibleProducts]);

  // Hovered point resolved back to the source data (for the tooltip).
  const hoveredPoint = useMemo(() => {
    if (!hoverState || !projection) return null;
    const series = visibleProducts[hoverState.productIndex];
    const projected = projection.projectedSeries[hoverState.productIndex];
    if (!series || !projected) return null;
    const point = series.points[hoverState.pointIndex];
    const coords = projected[hoverState.pointIndex];
    if (!point || !coords) return null;
    // Look up the ABSOLUTE color from the full products list so hiding a
    // product doesn't shift colors of the remaining ones.
    const absoluteIndex = products.findIndex((p) => p.productId === series.productId);
    return {
      point,
      coords,
      productName: series.productName,
      color: getProductColor(absoluteIndex >= 0 ? absoluteIndex : hoverState.productIndex),
    };
  }, [hoverState, projection, visibleProducts, products]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Historial de precios</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Evolución del precio de compra (EUR sin margen) de todos los productos importados.
            Haz clic en la leyenda para ocultar productos o alterna los puntos con el botón inferior.
          </p>
        </div>

        {/* Variant selector — segmented control */}
        <div className="inline-flex rounded-xl border border-gray-300 overflow-hidden self-start">
          {(['SHRINK', 'NO_SHRINK'] as const).map((v) => {
            const active = variant === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                {v === 'SHRINK' ? 'Shrink' : 'No Shrink'}
              </button>
            );
          })}
        </div>

        {/* Chart canvas */}
        <div className="relative w-full">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm">
              <span className="h-6 w-6 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              No hay datos históricos para esta variante todavía.
            </div>
          )}

          {!loading && !error && products.length > 0 && visibleProducts.length === 0 && (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              Todos los productos están ocultos. Muestra alguno desde la leyenda.
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-red-200 bg-red-50 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && visibleProducts.length > 0 && projection && (
            <div className="relative w-full">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                className="w-full h-auto max-h-[500px] select-none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                role="img"
                aria-label="Gráfico de histórico de precios de compra de todos los productos"
              >
                {/* Y-axis gridlines + labels */}
                {yTicks.map((t, i) => (
                  <g key={`y-${i}`}>
                    <line
                      x1={PAD.left}
                      x2={CHART_W - PAD.right}
                      y1={t.y}
                      y2={t.y}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <text
                      x={PAD.left - 8}
                      y={t.y + 4}
                      textAnchor="end"
                      className="fill-gray-500"
                      fontSize={11}
                    >
                      {eurFmt.format(t.value)}
                    </text>
                  </g>
                ))}

                {/* X-axis baseline */}
                <line
                  x1={PAD.left}
                  x2={CHART_W - PAD.right}
                  y1={CHART_H - PAD.bottom}
                  y2={CHART_H - PAD.bottom}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />

                {/* X-axis labels */}
                {xTicks.map((t, i) => (
                  <text
                    key={`x-${i}`}
                    x={t.x}
                    y={CHART_H - PAD.bottom + 18}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize={11}
                  >
                    {t.label}
                  </text>
                ))}

                {/* Smooth lines for each VISIBLE product */}
                {visibleProducts.map((product, pIdx) => {
                  const projected = projection.projectedSeries[pIdx];
                  if (!projected || projected.length === 0) return null;

                  const smoothPath = buildSmoothPath(projected);
                  // Color is derived from the product's ABSOLUTE position in
                  // the full list, so hiding entries doesn't shuffle colors.
                  const absoluteIndex = products.findIndex(
                    (p) => p.productId === product.productId
                  );
                  const color = getProductColor(absoluteIndex >= 0 ? absoluteIndex : pIdx);

                  return (
                    <path
                      key={`line-${product.productId}`}
                      d={smoothPath}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={
                        hoverState === null || hoverState.productIndex === pIdx ? 1 : 0.2
                      }
                      className="transition-opacity"
                    />
                  );
                })}

                {/* Per-point dots for every visible series (togglable). The
                    hovered point is rendered separately below, so we skip it
                    here to avoid a double-stacked marker. */}
                {showDots &&
                  visibleProducts.map((product, pIdx) => {
                    const projected = projection.projectedSeries[pIdx];
                    if (!projected || projected.length === 0) return null;

                    const absoluteIndex = products.findIndex(
                      (p) => p.productId === product.productId
                    );
                    const color = getProductColor(absoluteIndex >= 0 ? absoluteIndex : pIdx);
                    const seriesOpacity =
                      hoverState === null || hoverState.productIndex === pIdx ? 1 : 0.2;

                    return (
                      <g
                        key={`pts-${product.productId}`}
                        opacity={seriesOpacity}
                        className="transition-opacity"
                      >
                        {projected.map((p, ptIdx) => {
                          const isHovered =
                            hoverState?.productIndex === pIdx &&
                            hoverState?.pointIndex === ptIdx;
                          if (isHovered) return null;
                          return (
                            <circle
                              key={`pt-${product.productId}-${ptIdx}`}
                              cx={p.x}
                              cy={p.y}
                              r={3}
                              fill="#fff"
                              stroke={color}
                              strokeWidth={2}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                {/* Enlarged marker + crosshair for the hovered point only. */}
                {hoverState !== null && hoveredPoint && (
                  <>
                    <line
                      x1={hoveredPoint.coords.x}
                      x2={hoveredPoint.coords.x}
                      y1={PAD.top}
                      y2={CHART_H - PAD.bottom}
                      stroke={hoveredPoint.color}
                      strokeWidth={1}
                      strokeDasharray="2 3"
                      opacity={0.5}
                    />
                    <circle
                      cx={hoveredPoint.coords.x}
                      cy={hoveredPoint.coords.y}
                      r={6}
                      fill="#fff"
                      stroke={hoveredPoint.color}
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </svg>

              {/* Tooltip */}
              {hoverState !== null && hoveredPoint && (
                <ChartTooltip
                  point={hoveredPoint.point}
                  productName={hoveredPoint.productName}
                  productColor={hoveredPoint.color}
                  x={((hoveredPoint.coords.x / CHART_W) * 100).toFixed(1)}
                  y={((hoveredPoint.coords.y / CHART_H) * 100).toFixed(1)}
                />
              )}
            </div>
          )}
        </div>

        {/* Legend — click to toggle visibility */}
        {products.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {visibleProducts.length} de {products.length} productos visibles
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDots((v) => !v)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                    showDots
                      ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-pressed={showDots}
                  title="Mostrar u ocultar los puntos de cada precio"
                >
                  {showDots ? '● Puntos visibles' : '○ Puntos ocultos'}
                </button>
                {hiddenProducts.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setHiddenProducts(new Set())}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Mostrar todos
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {products.map((product, idx) => {
                const isHidden = hiddenProducts.has(product.productId);
                return (
                  <button
                    key={product.productId}
                    type="button"
                    onClick={() => toggleProduct(product.productId)}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
                      isHidden
                        ? 'bg-gray-100 opacity-60 hover:opacity-80'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    aria-pressed={!isHidden}
                    title={
                      isHidden
                        ? `Mostrar "${product.productName}"`
                        : `Ocultar "${product.productName}"`
                    }
                  >
                    <div
                      className={`h-3 w-3 rounded-full flex-shrink-0 border ${
                        isHidden ? 'border-gray-400' : 'border-transparent'
                      }`}
                      style={{
                        backgroundColor: isHidden ? 'transparent' : getProductColor(idx),
                        borderColor: isHidden ? getProductColor(idx) : 'transparent',
                      }}
                    />
                    <span
                      className={`truncate ${
                        isHidden ? 'text-gray-400 line-through' : 'text-gray-700'
                      }`}
                    >
                      {product.productName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  point: ChartPoint;
  productName: string;
  productColor: string;
  /** X position as a percentage of chart width (0–100). */
  x: string;
  /** Y position as a percentage of chart height (0–100). */
  y: string;
}

function ChartTooltip({ point, productName, productColor, x, y }: TooltipProps) {
  // Anchor above the point; flip below when near the top of the chart.
  const above = parseFloat(y) > 30;
  const iso = new Date(parseDateUtc(point.date));

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg bg-gray-900 text-white shadow-lg px-3 py-2 text-xs whitespace-nowrap"
      style={{
        left: `${x}%`,
        top: above ? `calc(${y}% - 12px)` : `calc(${y}% + 20px)`,
        transform: `translate(-50%, ${above ? '-100%' : '0'})`,
      }}
    >
      <div className="flex items-center gap-2 font-semibold mb-1">
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: productColor }}
        />
        <span className="max-w-[200px] truncate">{productName}</span>
      </div>
      <div className="mt-1 space-y-0.5 text-gray-200">
        <div>{dateFmt.format(iso)}</div>
        <div>
          Precio compra:{' '}
          <span className="font-mono text-white">{eurFmt.format(point.purchasePriceEur)}</span>
        </div>
        <div>
          JPY: <span className="font-mono">{jpyFmt.format(point.priceJpy)}</span>
        </div>
        <div>
          Tasa: <span className="font-mono">1 JPY = {point.exchangeRate.toFixed(6)} EUR</span>
        </div>
      </div>
    </div>
  );
}
