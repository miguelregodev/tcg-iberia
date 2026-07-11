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
      className={`text-sm font-semibold ${
        inventoryState.status === 'preorder'
          ? 'text-blue-700'
          : inventoryState.status === 'available'
            ? 'text-green-600'
            : inventoryState.status === 'low_stock'
              ? 'text-orange-600'
              : 'text-red-600'
      }`}
    >
      {getProductStatusLabel(inventoryState)}
    </span>
  );
}
