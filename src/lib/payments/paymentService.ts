/**
 * Generic payment service layer
 *
 * Handles payment-related business logic independently of payment provider.
 * Triggered by payment success/failure from any provider (Stripe, Redsys, etc.)
 */

import 'server-only';

import { db } from '@/lib/db';
import { sendOrderEmails } from '@/lib/email';
import { captureServerError } from '@/lib/observability/sentry';
import { captureServerEvent } from '@/lib/analytics/posthog-server';
import { Prisma } from '@prisma/client';

interface PaymentSuccessContext {
  orderId: string;
  orderNumber: string;
  paymentAmount: number;
  paymentCurrency: string;
  transactionId?: string;
}

interface PaymentFailureContext {
  orderId: string;
  orderNumber: string;
  reason: string;
}

/**
 * Handle successful payment
 *
 * This is called after payment is confirmed by the payment provider.
 * It updates order status, decrements stock (if not already done), and triggers post-payment actions.
 *
 * @param context - Payment success context
 * @returns Updated order
 * @throws Error if transaction fails
 */
export async function handlePaymentSuccess(context: PaymentSuccessContext) {
  const {
    orderId,
    orderNumber,
    paymentAmount,
    paymentCurrency,
    transactionId,
  } = context;

  try {
    const order = await db.$transaction(async (tx) => {
      // Fetch order to check current state
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          email: true,
          fullName: true,
          phone: true,
          totalAmount: true,
          items: true,
          shippingAddress: true,
          shippingPostalCode: true,
          shippingCity: true,
          shippingLocality: true,
          shippingProvince: true,
        },
      });

      if (!currentOrder) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Check idempotency: if already PAID, return without re-processing
      if (currentOrder.paymentStatus === 'PAID') {
        return currentOrder;
      }

      // Decrement stock for non-preorder items
      if (Array.isArray(currentOrder.items)) {
        const items = currentOrder.items as Array<{
          id?: string;
          isPreorder?: boolean;
          quantity?: number;
        }>;

        for (const item of items) {
          if (!item.isPreorder && item.id && item.quantity && item.quantity > 0) {
            const updateStock = await tx.product.updateMany({
              where: {
                id: item.id,
                stock: { gte: item.quantity },
              },
              data: {
                stock: { decrement: item.quantity },
              },
            });

            if (updateStock.count === 0) {
              throw new Error(
                `Insufficient stock for product ${item.id} during payment processing`
              );
            }
          }
        }
      }

      // Update order with payment confirmation
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paymentAmount: paymentAmount / 100, // Convert from cents to EUR
          paymentCurrency,
          paymentPaidAt: new Date(),
          status: 'PROCESSING', // Move to fulfillment
        },
        select: {
          id: true,
          orderNumber: true,
          email: true,
          fullName: true,
          phone: true,
          totalAmount: true,
          items: true,
          shippingAddress: true,
          shippingPostalCode: true,
          shippingCity: true,
          shippingLocality: true,
          shippingProvince: true,
          paymentStatus: true,
        },
      });

      return updatedOrder;
    });

    // Post-payment side effects (outside transaction)
    try {
      // Track preorder purchases in analytics
      if (Array.isArray(order.items)) {
        const preorderItems = (order.items as Array<{
          id?: string;
          name?: string;
          releaseDate?: string;
          isPreorder?: boolean;
        }>).filter((item) => item.isPreorder && typeof item.releaseDate === 'string');

        await Promise.all(
          preorderItems.map((item) =>
            captureServerEvent(order.email, 'preorder_purchased', {
              productId: item.id,
              productName: item.name,
              orderId: order.id,
              releaseDate: item.releaseDate,
            })
          )
        );
      }

      // Calculate shipping cost accurately for email display
      const itemsTotal = (order.items as Array<{
        quantity?: number;
        price?: number;
        discountPercentage?: number;
      }>).reduce((sum, item) => {
        const unitPrice = (item.price || 0) * (1 - ((item.discountPercentage || 0) / 100));
        return sum + (unitPrice * (item.quantity || 0));
      }, 0);

      const totalAmount = parseFloat(order.totalAmount.toString());
      const shippingCost = Math.round((totalAmount - itemsTotal) * 100) / 100;

      // Send confirmation emails
      await sendOrderEmails({
        orderNumber: order.orderNumber,
        fullName: order.fullName,
        email: order.email,
        phone: order.phone,
        totalAmount,
        items: (order.items as Array<{
          name?: string;
          quantity?: number;
          price?: number;
          discountPercentage?: number;
        }>).map((item) => ({
          name: item.name || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          discountPercentage: item.discountPercentage,
        })),
        paymentStatus: 'paid',
        shippingCost,
        shipping: {
          address: order.shippingAddress,
          postalCode: order.shippingPostalCode,
          city: order.shippingCity,
          locality: order.shippingLocality,
          province: order.shippingProvince,
        },
      });

      // Track checkout completion
      captureServerEvent(order.email, 'checkout_completed', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: parseFloat(order.totalAmount.toString()),
        paymentMethod: 'redsys',
      });
    } catch (error) {
      // Log but don't fail the transaction - payment is confirmed
      captureServerError({
        error,
        module: 'payment_success_side_effects',
        extra: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          transactionId,
        },
      });
    }

    return order;
  } catch (error) {
    captureServerError({
      error,
      module: 'payment_success_handler',
      extra: {
        orderId,
        orderNumber,
        transactionId,
      },
    });

    throw error;
  }
}

/**
 * Handle failed payment
 *
 * Updates order payment status to PAYMENT_FAILED and fulfillment status to FAILED.
 * Does NOT decrement stock (order was never paid).
 *
 * @param context - Payment failure context
 * @returns Updated order
 * @throws Error if update fails
 */
export async function handlePaymentFailure(context: PaymentFailureContext) {
  const { orderId, orderNumber, reason } = context;

  try {
    const order = await db.$transaction(async (tx) => {
      // Fetch current order
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: { paymentStatus: true, status: true },
      });

      if (!currentOrder) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Check idempotency: if already PAYMENT_FAILED, return without re-processing
      if (currentOrder.paymentStatus === 'PAYMENT_FAILED') {
        return currentOrder;
      }

      // Update order with payment failure and set fulfillment status to FAILED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAYMENT_FAILED',
          status: 'FAILED', // Mark order as failed when payment fails
        },
        select: { id: true, paymentStatus: true, status: true },
      });

      return updatedOrder;
    });

    // Log failure to analytics
    captureServerEvent(orderNumber, 'checkout_failed', {
      orderId,
      reason,
      paymentMethod: 'redsys',
    });

    return order;
  } catch (error) {
    captureServerError({
      error,
      module: 'payment_failure_handler',
      extra: {
        orderId,
        orderNumber,
        reason,
      },
    });

    throw error;
  }
}

/**
 * Verify payment matches order details
 *
 * @param order - Order from database
 * @param paymentAmount - Amount from payment provider (in cents)
 * @param paymentCurrency - Currency code from payment provider
 * @throws Error if amounts or currency don't match
 */
export function verifyPaymentAmount(
  order: { totalAmount: Prisma.Decimal; id: string },
  paymentAmount: number,
  paymentCurrency: string
): void {
  // Convert order amount to cents for comparison (assuming EUR)
  const expectedAmountCents = Math.round(
    parseFloat(order.totalAmount.toString()) * 100
  );

  // Allow small variance for rounding (±1 cent)
  const variance = Math.abs(paymentAmount - expectedAmountCents);
  if (variance > 1) {
    throw new Error(
      `Payment amount mismatch: expected ${expectedAmountCents} cents, received ${paymentAmount} cents`
    );
  }

  // Verify currency
  if (paymentCurrency !== '978' && paymentCurrency !== 'EUR') {
    throw new Error(
      `Payment currency mismatch: expected EUR (978), received ${paymentCurrency}`
    );
  }
}
