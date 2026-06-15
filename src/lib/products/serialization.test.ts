import { describe, expect, it } from 'vitest';

import { serializePublicProduct } from './serialization';

describe('serializePublicProduct', () => {
  it('marks future releases as preorder and keeps release date normalized', () => {
    const serialized = serializePublicProduct({
      id: 'prod_1',
      name: 'Reserva test',
      slug: 'reserva-test',
      description: 'Producto de reserva',
      price: { toString: () => '24.99' } as never,
      discountPercentage: null,
      notes: null,
      type: 'Booster Pack',
      releaseDate: new Date('2026-08-15T00:00:00.000Z'),
      stock: 0,
      imageUrl: null,
      language: 'SPANISH',
      priority: 1,
      visible: true,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    });

    expect(serialized.isPreorder).toBe(true);
    expect(serialized.canPurchase).toBe(true);
    expect(serialized.inventoryStatus).toBe('preorder');
    expect(serialized.releaseDate).toBe('2026-08-15T00:00:00.000Z');
  });

  it('keeps normal in-stock products available', () => {
    const serialized = serializePublicProduct({
      id: 'prod_2',
      name: 'Producto normal',
      slug: 'producto-normal',
      description: 'Producto normal',
      price: { toString: () => '10.00' } as never,
      discountPercentage: null,
      notes: null,
      type: 'Booster Box',
      releaseDate: null,
      stock: 9,
      imageUrl: null,
      language: 'ENGLISH',
      priority: 2,
      visible: true,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    });

    expect(serialized.isPreorder).toBe(false);
    expect(serialized.inventoryStatus).toBe('available');
    expect(serialized.available).toBe(true);
  });
});