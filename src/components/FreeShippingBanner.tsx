'use client';

import { useCart } from '@/context/CartContext';
import { FreeShippingProgress } from './FreeShippingProgress';
import { getFreeShippingState } from '@/lib/shipping/free-shipping';
import { useMemo } from 'react';

export function FreeShippingBanner() {
  const { totalPrice } = useCart();
  const freeShippingState = useMemo(() => getFreeShippingState(totalPrice), [totalPrice]);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-[60px] z-40 shadow-sm">
      <div className="container-custom px-4 py-3">
        <FreeShippingProgress
          state={freeShippingState}
          context="cart"
          className="!bg-transparent !border-0 !p-0"
        />
      </div>
    </div>
  );
}
