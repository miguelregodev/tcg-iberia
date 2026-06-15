import { describe, expect, it } from 'vitest';

import {
  formatReleaseDate,
  getProductInventoryState,
  getProductPurchaseLabel,
  getProductStatusLabel,
  isPreorderProduct,
} from './state';

describe('product inventory state', () => {
  const now = new Date('2026-06-15T10:00:00.000Z');

  it('classifies future releases as preorder even when stock is zero', () => {
    const state = getProductInventoryState(
      {
        stock: 0,
        releaseDate: '2026-07-01T00:00:00.000Z',
      },
      now,
    );

    expect(state.status).toBe('preorder');
    expect(state.isPreorder).toBe(true);
    expect(state.canPurchase).toBe(true);
    expect(state.isOutOfStock).toBe(false);
    expect(getProductStatusLabel(state)).toBe('Reserva');
    expect(getProductPurchaseLabel(state)).toBe('Reservar');
  });

  it('classifies stocked products as available', () => {
    const state = getProductInventoryState(
      {
        stock: 8,
        releaseDate: '2026-06-01T00:00:00.000Z',
      },
      now,
    );

    expect(state.status).toBe('available');
    expect(state.isAvailable).toBe(true);
    expect(state.canPurchase).toBe(true);
    expect(getProductStatusLabel(state)).toBe('Disponible');
    expect(getProductPurchaseLabel(state)).toBe('Añadir al carrito');
  });

  it('classifies low stock products correctly', () => {
    const state = getProductInventoryState(
      {
        stock: 3,
        releaseDate: null,
      },
      now,
    );

    expect(state.status).toBe('low_stock');
    expect(state.isLowStock).toBe(true);
    expect(state.canPurchase).toBe(true);
  });

  it('classifies past release zero stock products as out of stock', () => {
    const state = getProductInventoryState(
      {
        stock: 0,
        releaseDate: '2026-06-01T00:00:00.000Z',
      },
      now,
    );

    expect(state.status).toBe('out_of_stock');
    expect(state.canPurchase).toBe(false);
  });

  it('detects preorder using release date as the only source of truth', () => {
    expect(isPreorderProduct('2026-09-15T00:00:00.000Z', now)).toBe(true);
    expect(isPreorderProduct('2026-06-15T10:00:00.000Z', now)).toBe(false);
    expect(isPreorderProduct('2026-05-30T00:00:00.000Z', now)).toBe(false);
  });

  it('formats release dates in spanish locale', () => {
    expect(formatReleaseDate('2026-09-15T00:00:00.000Z')).toBe('15/09/2026');
  });
});