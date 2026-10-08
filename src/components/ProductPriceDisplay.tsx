'use client';

/**
 * ProductPriceDisplay
 *
 * Client-side price renderer that swaps in the B2B wholesale price when the
 * current user has an ACTIVE B2B session. Falls back to the standard public
 * price (with any discount) otherwise, so anonymous visitors see the same
 * price they always have.
 *
 * The overrides come from a batched `/api/b2b/prices` fetch — see
 * `src/hooks/useB2BPrices.ts`. Public HTML never contains the wholesale
 * price, so scraping the SSR output does not leak B2B rates.
 */

import { useB2BSession } from '@/context/B2BSessionContext';
import { useB2BPrices, resolveEffectivePrice } from '@/hooks/useB2BPrices';

interface Props {
  productId: string;
  publicPrice: number;
  discountPercentage?: number | null;
  /** Optional lower price for the "Apertura en directo" variant — when present, catalog shows "Desde" + lowest price. */
  liveOpeningPrice?: number | null;
  /** Optional class overrides for the price container. */
  className?: string;
  /** Optional class override for the price text itself (defaults to the compact catalog-card size). */
  priceClassName?: string;
}

export function ProductPriceDisplay({
  productId,
  publicPrice,
  discountPercentage,
  liveOpeningPrice,
  className,
  priceClassName,
}: Props) {
  const { isB2B } = useB2BSession();
  const overrides = useB2BPrices(isB2B ? [productId] : []);
  const { price, isB2B: usingB2B } = resolveEffectivePrice({
    productId,
    publicPrice,
    overrides,
  });

  const discounted = !usingB2B && !!discountPercentage && discountPercentage > 0;
  const applyDiscount = (value: number) =>
    discounted ? value * (1 - (discountPercentage ?? 0) / 100) : value;
  const hasLiveOpening = !usingB2B && liveOpeningPrice != null;
  // The discount applies to both formats; show the cheapest one.
  const sealedFinal = applyDiscount(publicPrice);
  const liveFinal = hasLiveOpening ? applyDiscount(liveOpeningPrice as number) : null;
  const useLive = liveFinal != null && liveFinal <= sealedFinal;
  const originalPrice = useLive ? (liveOpeningPrice as number) : publicPrice;
  const displayPrice = usingB2B ? price : useLive ? (liveFinal as number) : sealedFinal;

  return (
    <div className={className ?? 'flex items-center gap-2'}>
      {hasLiveOpening && (
        <span className="text-[11px] text-text-muted">Desde</span>
      )}
      <p className={priceClassName ?? 'text-premium-gold font-bold text-sm'}>
        {displayPrice.toFixed(2)}€
      </p>
      {discounted && (
        <p className="text-[11px] text-text-muted line-through">
          {originalPrice.toFixed(2)}€
        </p>
      )}
      {usingB2B && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide bg-premium-gold/15 text-premium-gold"
          title="Precio mayorista B2B"
        >
          B2B
        </span>
      )}
    </div>
  );
}
