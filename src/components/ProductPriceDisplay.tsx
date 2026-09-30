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
}

export function ProductPriceDisplay({
  productId,
  publicPrice,
  discountPercentage,
  liveOpeningPrice,
  className,
}: Props) {
  const { isB2B } = useB2BSession();
  const overrides = useB2BPrices(isB2B ? [productId] : []);
  const { price, isB2B: usingB2B } = resolveEffectivePrice({
    productId,
    publicPrice,
    overrides,
  });

  const discounted = !usingB2B && discountPercentage && discountPercentage > 0;
  const finalPublic = discounted
    ? publicPrice * (1 - (discountPercentage ?? 0) / 100)
    : publicPrice;
  const hasLiveOpening = !usingB2B && liveOpeningPrice != null;
  const lowestPrice = hasLiveOpening
    ? Math.min(finalPublic, liveOpeningPrice as number)
    : finalPublic;
  const displayPrice = usingB2B ? price : lowestPrice;

  return (
    <div className={className ?? 'flex items-center gap-2'}>
      {hasLiveOpening && (
        <span className="text-[11px] text-text-muted">Desde</span>
      )}
      <p className="text-premium-gold font-bold text-sm">
        {displayPrice.toFixed(2)}€
      </p>
      {discounted && !hasLiveOpening && (
        <p className="text-[11px] text-text-muted line-through">
          {publicPrice.toFixed(2)}€
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
