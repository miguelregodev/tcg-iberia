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
import { captureServerError } from '@/lib/observability/sentry';
import { calculateSubtotal } from '@/lib/shipping/free-shipping';
import { calculateShippingCost } from '@/lib/shipping/shipping-calculator';
import { isCanaryIslandsPostalCode } from '@/lib/shipping/postal-codes';
import { SHIPPING_CONFIG } from '@/lib/shipping/config';
import { isOrderItemSnapshot } from '@/lib/orders/items';
import { getRedsysConfig, getRedsysApiUrl } from '@/lib/payments/redsys/config';
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
}

async function getNextRedsysOrderId(): Promise<string> {
  const sequence = await db.sequence.upsert({
    where: { name: 'REDSYS_ORDER' },
    create: { name: 'REDSYS_ORDER', value: 1 },
    update: { value: { increment: 1 } },
  });

  return String(sequence.value).padStart(12, '0');
}

export async function POST(request: NextRequest) {
  let customerEmail: string | undefined;

  try {
    const body = (await request.json()) as CreateRedsysPaymentRequest;
    const { items, customerData } = body;
    customerEmail = customerData?.email;

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

    // Calculate shipping cost based on postal code (Canary Islands, Baleares, etc.)
    const shippingResult = calculateShippingCost(
      shippingItems,
      customerData.shippingPostalCode,
      subtotal,
      SHIPPING_CONFIG.freeShippingThreshold
    );

    // Use calculated shipping cost, default to standard if calculation unavailable
    const shippingCost = shippingResult.available ? shippingResult.price || 0 : SHIPPING_CONFIG.standardShippingCost;
    const totalAmount = subtotal + shippingCost;
    const totalAmountCents = Math.round(totalAmount * 100);

    // Get Redsys configuration
    const config = getRedsysConfig();

    // Generate order number (customer-facing)
    const generateOrderNumber = async (): Promise<string> => {
      const sequence = await db.sequence.upsert({
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

    const orderNumber = await generateOrderNumber();
    const redsysOrderId = await getNextRedsysOrderId();

    // Create order with PENDING_PAYMENT status
    const order = await db.$transaction(async (tx) => {
      // Link customer if exists
      const linkedUser = customerEmail
        ? await tx.user.findUnique({
            where: { email: customerEmail },
            select: { id: true },
          })
        : null;

      return tx.order.create({
        data: {
          orderNumber,
          redsysOrderId,
          paymentProvider: 'redsys',
          paymentStatus: 'PENDING_PAYMENT',
          userId: linkedUser?.id ?? null,
          fullName: customerData.fullName,
          email: customerData.email.toLowerCase(),
          phone: customerData.phone,
          shippingAddress: customerData.shippingAddress,
          shippingPostalCode: customerData.shippingPostalCode,
          shippingCity: customerData.shippingCity,
          shippingLocality: customerData.shippingLocality,
          shippingProvince: customerData.shippingProvince,
          totalAmount: String(totalAmount),
          status: 'PROCESSING',
          items: items as unknown as Prisma.InputJsonValue,
        },
        select: {
          id: true,
          orderNumber: true,
          redsysOrderId: true,
          totalAmount: true,
          email: true,
        },
      });
    });

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
