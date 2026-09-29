/**
 * GET /api/orders/get-by-order-number
 *
 * Fetch order by customer-facing order number
 *
 * Query params:
 * - orderNumber: Customer-facing order number (e.g., TCG-20260926-000123)
 *
 * Response:
 * {
 *   id: string,
 *   orderNumber: string,
 *   email: string,
 *   fullName: string,
 *   paymentStatus: string,
 *   totalAmount: number,
 *   items: Array
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const orderNumber = request.nextUrl.searchParams.get('orderNumber');

    if (!orderNumber) {
      return NextResponse.json(
        { error: 'Order number is required' },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        fullName: true,
        paymentStatus: true,
        totalAmount: true,
        items: true,
        shippingAddress: true,
        shippingPostalCode: true,
        shippingCity: true,
        shippingLocality: true,
        shippingProvince: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Convert totalAmount to number
    const totalAmount = parseFloat(order.totalAmount.toString());

    // Calculate subtotal from items
    let itemsSubtotal = 0;
    if (Array.isArray(order.items)) {
      itemsSubtotal = (order.items as Array<{ price?: number; quantity?: number; discountPercentage?: number }>).reduce((sum, item) => {
        const itemPrice = item.price || 0;
        const itemQuantity = item.quantity || 0;
        const discount = item.discountPercentage || 0;
        const itemTotal = itemPrice * itemQuantity * (1 - discount / 100);
        return sum + itemTotal;
      }, 0);
    }

    // Calculate shipping cost
    const shippingCost = Math.round((totalAmount - itemsSubtotal) * 100) / 100;

    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      fullName: order.fullName,
      paymentStatus: order.paymentStatus,
      totalAmount,
      itemsSubtotal,
      shippingCost,
      items: order.items,
      shipping: {
        address: order.shippingAddress,
        postalCode: order.shippingPostalCode,
        city: order.shippingCity,
        locality: order.shippingLocality,
        province: order.shippingProvince,
      },
    });
  } catch (error) {
    console.error('Error fetching order by order number:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
