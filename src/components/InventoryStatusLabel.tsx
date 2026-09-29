'use client';

/**
 * InventoryStatusLabel
 *
 * Renders the standard "Disponible / Últimas unidades / Sin stock" pill on
 * public product cards. When an ACTIVE B2B session is detected the pill is
 * suppressed entirely — wholesale customers must not see per-unit stock
 * information (they still cannot add more than what is available, the
 * limit is enforced server-side).
 *
 * The className / colour logic mirrors what ProductCard used to render
 * inline, so replacing the inline block with this component keeps public
 * users' UI unchanged.
 */

import { getProductStatusLabel, type ProductInventoryState } from '@/lib/products/state';
import { useB2BSession } from '@/context/B2BSessionContext';

interface Props {
  inventoryState: ProductInventoryState;
}

export function InventoryStatusLabel({ inventoryState }: Props) {
  const { isB2B } = useB2BSession();
  if (isB2B) return null;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
        inventoryState.status === 'preorder'
          ? 'bg-premium-gold/15 text-premium-gold'
          : inventoryState.status === 'available'
            ? 'bg-success-bg text-success'
            : inventoryState.status === 'low_stock'
              ? 'bg-warning-bg text-warning'
              : 'bg-danger-bg text-danger'
      }`}
    >
      {getProductStatusLabel(inventoryState)}
    </span>
  );
}
