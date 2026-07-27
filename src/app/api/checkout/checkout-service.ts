import { Product } from '@prisma/client';

import { db } from '@/lib/db';
import { calculateSubtotal, getFreeShippingState } from '@/lib/shipping/free-shipping';

export interface CheckoutItem {
  id: string;
  quantity: number;
}

export interface CheckoutCustomerData {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
  customerData: CheckoutCustomerData;
}

export interface CheckoutProduct {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CheckoutSummary {
  products: CheckoutProduct[];
  subtotal: number;
  shippingCost: number;
  total: number;
}

export class CheckoutService {

  /**
   * Loads every product from the database and recalculates the
   * checkout completely server-side.
   *
   * Never trust prices coming from the browser.
   */
  async buildCheckout(
    request: CheckoutRequest,
  ): Promise<CheckoutSummary> {

    if (request.items.length === 0) {
      throw new Error('Cart is empty.');
    }

    const ids = request.items.map((i) => i.id);

    const products = await db.product.findMany({
      where: {
        id: {
          in: ids,
        },
        visible: true,
      },
    });

    const productMap = new Map(
      products.map((p) => [p.id, p]),
    );

    const checkoutProducts: CheckoutProduct[] = [];

    for (const item of request.items) {
      const product = productMap.get(item.id);
      if (!product) {
        throw new Error(`Product "${item.id}" does not exist.`);
      }

      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity for "${product.name}".`);
      }

      const unitPrice = product.discountPercentage
        ? Number(product.price) *
          (1 - Number(product.discountPercentage) / 100)
        : Number(product.price);

      checkoutProducts.push({
        product,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      });

    }

    const subtotal = calculateSubtotal(
      checkoutProducts.map((item) => ({
        price: item.unitPrice,
        quantity: item.quantity,
      })),

    );

    const shippingState = getFreeShippingState(subtotal);

    return {
      products: checkoutProducts,
      subtotal,
      shippingCost: shippingState.shippingCost,
      total: subtotal + shippingState.shippingCost,
    };

  }

}

export const checkoutService =
  new CheckoutService();