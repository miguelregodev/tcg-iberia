/**
 * POST /api/payments/redsys/create
 *
 * Creates a Redsys payment for an order.
 *
 * Request body:
 * {
 *   items: CheckoutItem[],
 *   customerData: CustomerData
 * }
 *
 * Response:
 * {
 *   Ds_MerchantParameters: string (base64url encoded),
 *   Ds_Signature: string (base64url encoded),
 *   Ds_SignatureVersion: string,
 *   Ds_MerchantCode: string,
 *   Ds_Terminal: string,
 *   url: string (Redsys payment form URL)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { captureServerError } from '@/lib/observability/sentry';
import { calculateSubtotal } from '@/lib/shipping/free-shipping';
import { resolveShippingCost } from '@/lib/shipping/resolve-shipping-cost';
import { SHIPPING_CONFIG } from '@/lib/shipping/config';
import { isOrderItemSnapshot } from '@/lib/orders/items';
import { RETRIABLE_PAYMENT_STATUSES } from '@/lib/orders/retry';
import { getRedsysConfig, getRedsysApiUrl } from '@/lib/payments/redsys/config';
import { nextRedsysOrderId } from '@/lib/payments/redsys/orderId';
import {
  generateSignature,
  toBase64,
} from '@/lib/payments/redsys/signature';
import {
  RedsysMerchantParameters,
} from '@/lib/payments/redsys/types';

interface CheckoutItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number;
  imageUrl?: string;
  releaseDate?: string | null;
  isPreorder?: boolean;
}

interface CustomerData {
  fullName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingLocality: string;
  shippingProvince: string;
}

interface CreateRedsysPaymentRequest {
  items: CheckoutItem[];
  customerData?: CustomerData;
  /** "Agrupar Envío" checkbox — only honored for authenticated customers (see POST handler). */
  groupedShipping?: boolean;
  /** Client-persisted cart id. When an open (unpaid) order already exists for this cart,
   * it's updated in place instead of creating a duplicate — covers failed/abandoned
   * payment retries and "added more items, retry" without ever stacking new orders. */
  cartId?: string;
}

export async function POST(request: NextRequest) {
  let customerEmail: string | undefined;

  try {
    const body = (await request.json()) as CreateRedsysPaymentRequest;
    const { items, customerData } = body;
    customerEmail = customerData?.email;

    // Never trust the client flag alone: grouped shipping requires an authenticated
    // session. Guests (and any tampered request) silently fall back to immediate shipping.
    const session = await auth();
    const isAuthenticated = Boolean(session?.user?.id);
    const groupedShipping = Boolean(body.groupedShipping) && isAuthenticated;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items in cart' },
        { status: 400 }
      );
    }

    if (!items.every(isOrderItemSnapshot)) {
      return NextResponse.json(
        { error: 'Invalid checkout items' },
        { status: 400 }
      );
    }

    if (!customerData) {
      return NextResponse.json(
        { error: 'Customer data is required' },
        { status: 400 }
      );
    }

    // Calculate totals with zone-aware shipping (Canary Islands, Baleares, etc.)
    const subtotal = calculateSubtotal(
      items.map((item) => ({
        price: item.price,
        quantity: item.quantity,
        discountPercentage: item.discountPercentage,
      }))
    );

    // Fetch product data for shipping calculation (weight, dimensions)
    const productIds = items.map((item) => item.id);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        weightGrams: true,
        lengthCm: true,
        widthCm: true,
        heightCm: true,
      },
    });

    // Build shipping items array with product details
    const shippingItems = items.map((item) => {
      const product = products.find((p) => p.id === item.id);
      return {
        quantity: item.quantity,
        weightGrams: product?.weightGrams || null,
        lengthCm: product?.lengthCm || null,
        widthCm: product?.widthCm || null,
        heightCm: product?.heightCm || null,
      };
    });

    // Grouped shipping ('Agrupar Envío'): the customer explicitly defers this order's
    // shipment, so no shipping fee is collected now. The fee is computed once — from the
    // combined merchandise value of whichever orders end up in the consolidated shipment —
    // and collected via a single payment when the customer requests shipment later
    // (see /api/user/shipments/request). This guarantees the customer is never charged
    // shipping twice, without requiring any refund capability.
    const shippingCost = groupedShipping
      ? 0
      : resolveShippingCost(
          shippingItems,
          customerData.shippingPostalCode,
          subtotal,
          SHIPPING_CONFIG.freeShippingThreshold
        );
    const totalAmount = subtotal + shippingCost;
    const totalAmountCents = Math.round(totalAmount * 100);

    // Get Redsys configuration
    const config = getRedsysConfig();

    // Generate order number (customer-facing); reused across retries of the same cart.
    const generateOrderNumber = async (tx: Prisma.TransactionClient): Promise<string> => {
      const sequence = await tx.sequence.upsert({
        where: { name: 'ORDER' },
        create: { name: 'ORDER', value: 1 },
        update: { value: { increment: 1 } },
      });

      const timestamp = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
      const sequenceStr = String(sequence.value).padStart(6, '0');
      return `TCG-${timestamp}-${sequenceStr}`;
    };

    const redsysOrderId = await nextRedsysOrderId();
    const normalizedEmail = customerData.email.toLowerCase();
    const cartId = typeof body.cartId === 'string' && body.cartId.length > 0 ? body.cartId : null;

    // Create or reuse the order with PENDING_PAYMENT status
    const order = await db.$transaction(async (tx) => {
      // Prefer the authenticated session's user id, but verify it still exists (a JWT
      // session can outlive its User row, e.g. after a DB reset/account deletion) to
      // avoid a foreign key violation; fall back to matching by email otherwise.
      const sessionUserId = session?.user?.id
        ? (await tx.user.findUnique({ where: { id: session.user.id }, select: { id: true } }))?.id
        : undefined;
      const linkedUserId = sessionUserId
        ?? (customerEmail
          ? (await tx.user.findUnique({ where: { email: customerEmail }, select: { id: true } }))?.id
          : null);

      // Retry/resume support: if this cart already has an open (unpaid) order owned by
      // the same customer, update it in place instead of creating a duplicate — this is
      // what makes failed-payment retries, abandoned-checkout retries, and "added more
      // items then retried" all land on the SAME order instead of stacking new ones.
      const existingOrder = cartId
        ? await tx.order.findFirst({
            where: {
              cartId,
              email: normalizedEmail,
              userId: linkedUserId ?? null,
              paymentStatus: { in: [...RETRIABLE_PAYMENT_STATUSES] },
            },
            select: { id: true },
          })
        : null;

      const sharedData = {
        redsysOrderId,
        paymentProvider: 'redsys',
        paymentStatus: 'PENDING_PAYMENT' as const,
        userId: linkedUserId ?? null,
        fullName: customerData.fullName,
        email: normalizedEmail,
        phone: customerData.phone,
        shippingAddress: customerData.shippingAddress,
        shippingPostalCode: customerData.shippingPostalCode,
        shippingCity: customerData.shippingCity,
        shippingLocality: customerData.shippingLocality,
        shippingProvince: customerData.shippingProvince,
        totalAmount: String(totalAmount),
        status: 'PROCESSING' as const,
        shippingMode: groupedShipping ? ('GROUPED' as const) : ('IMMEDIATE' as const),
        items: items as unknown as Prisma.InputJsonValue,
        // Clear any stale attempt data left over from a previous failed/abandoned try.
        redsysTransactionId: null,
        redsysResponseCode: null,
        redsysAuthCode: null,
        paymentAmount: null,
        paymentPaidAt: null,
      };

      if (existingOrder) {
        return tx.order.update({
          where: { id: existingOrder.id },
          data: sharedData,
          select: {
            id: true,
            orderNumber: true,
            redsysOrderId: true,
            totalAmount: true,
            email: true,
          },
        });
      }

      const orderNumber = await generateOrderNumber(tx);
      return tx.order.create({
        data: { ...sharedData, orderNumber, cartId },
        select: {
          id: true,
          orderNumber: true,
          redsysOrderId: true,
          totalAmount: true,
          email: true,
        },
      });
    });

    const orderNumber = order.orderNumber;

    // Get origin for redirect URLs (browser redirects can stay on localhost in dev)
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Server-to-server notification URL: must be publicly reachable by Redsys.
    // In local dev, localhost is not reachable from Redsys - use REDSYS_NOTIFICATION_URL
    // (e.g. an ngrok tunnel) to override it while keeping URLOK/URLKO on localhost.
    const notificationUrl =
      process.env.REDSYS_NOTIFICATION_URL || `${origin}/api/payments/redsys/notification`;

    // Build Redsys merchant parameters (using official uppercase field names)
    const merchantParams: RedsysMerchantParameters = {
      DS_MERCHANT_AMOUNT: String(totalAmountCents),
      DS_MERCHANT_CURRENCY: '978', // EUR
      DS_MERCHANT_ORDER: redsysOrderId,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: '0', // 0 = Authorization
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: `${origin}/checkout/payment/success?order=${orderNumber}`,
      DS_MERCHANT_URLKO: `${origin}/checkout/payment/error?order=${orderNumber}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '1', // 1 = Spanish
    };

    // Log payment details (safe: no sensitive keys)
    console.log('[REDSYS] Order ID:', redsysOrderId);
    console.log('[REDSYS] Amount (cents):', totalAmountCents);
    console.log('[REDSYS] Notification URL:', notificationUrl);
    console.log('[REDSYS] Merchant Parameters:', merchantParams);

    // Encode merchant parameters as standard Base64 (Redsys does NOT use Base64URL)
    const merchantParametersJson = JSON.stringify(merchantParams);
    console.log('[REDSYS DEBUG] Merchant Parameters JSON:', merchantParametersJson);

    const merchantParametersBase64 = toBase64(merchantParametersJson);
    console.log('[REDSYS] Base64 Parameters:', merchantParametersBase64);

    // Generate signature using HMAC_SHA256_V1 (official Redsys algorithm)
    const signature = generateSignature(merchantParametersBase64, redsysOrderId);
    console.log('[REDSYS] Generated Signature:', signature);

    return NextResponse.json({
      Ds_MerchantParameters: merchantParametersBase64,
      Ds_Signature: signature,
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      Ds_MerchantCode: config.merchantCode,
      Ds_Terminal: config.terminal,
      url: getRedsysApiUrl(),
      orderNumber: order.orderNumber,
      redsysOrderId: order.redsysOrderId,
    });
  } catch (error: unknown) {
    console.error('[REDSYS] Payment creation error:', error);
    captureServerError({
      error,
      module: 'redsys_create_payment',
      request,
      userEmail: customerEmail,
    });

    const errorMessage = error instanceof Error ? error.message : 'Payment creation failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
