/**
 * POST /api/user/shipments/request
 *
 * Customer-facing "Solicitar envío" / consolidation endpoint. Accepts one or more of
 * the authenticated customer's own "Agrupar Envío" orders and atomically claims them
 * into a single Shipment, computing ONE shipping fee from their combined merchandise
 * value (reusing the exact same weight/threshold calculator used at checkout). If a
 * fee is owed, a single Redsys payment is created for it; if the combined value
 * reaches the free-shipping threshold, the shipment is marked ready immediately.
 *
 * Every order id is re-validated server-side (ownership + business-rule eligibility +
 * same shipping address) — the request body is never trusted blindly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { captureServerError } from '@/lib/observability/sentry';
import { resolveShippingCost } from '@/lib/shipping/resolve-shipping-cost';
import { SHIPPING_CONFIG } from '@/lib/shipping/config';
import { isOrderEligibleForShipmentRequest, haveSameShippingAddress } from '@/lib/shipments/eligibility';
import { generateShipmentNumber, nextRedsysOrderId } from '@/lib/shipments/numbers';
import { getRedsysConfig, getRedsysApiUrl } from '@/lib/payments/redsys/config';
import { generateSignature, toBase64 } from '@/lib/payments/redsys/signature';
import type { RedsysMerchantParameters } from '@/lib/payments/redsys/types';
import { notifyShipmentRequested } from '@/lib/shipments/notify';
import { getBaseProductId } from '@/lib/orders/pricing';

interface OrderItemSnapshot {
  id?: string;
  name?: string;
  quantity?: number;
  price?: number;
  discountPercentage?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = (await request.json()) as { orderIds?: unknown; preview?: unknown };
    const isPreview = body.preview === true;
    const orderIds = Array.from(
      new Set(
        Array.isArray(body.orderIds)
          ? body.orderIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : []
      )
    );

    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar al menos un pedido.' }, { status: 400 });
    }

    // Ownership check: never trust client-supplied order ids. Orders belonging to
    // another customer simply won't be returned here, so they fail the count check below.
    const orders = await db.order.findMany({
      where: { id: { in: orderIds }, userId },
    });

    if (orders.length !== orderIds.length) {
      return NextResponse.json(
        { error: 'Uno o más pedidos no existen o no te pertenecen.' },
        { status: 403 }
      );
    }

    if (!orders.every(isOrderEligibleForShipmentRequest)) {
      return NextResponse.json(
        {
          error:
            'Uno o más pedidos seleccionados ya no son elegibles para agrupar el envío (puede que ya se hayan enviado, cancelado o incluido en otra solicitud).',
        },
        { status: 409 }
      );
    }

    if (!haveSameShippingAddress(orders)) {
      return NextResponse.json(
        { error: 'Solo puedes agrupar pedidos con la misma dirección de envío.' },
        { status: 409 }
      );
    }

    const referenceOrder = orders[0];
    const merchandiseTotal = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount.toString()), 0);

    // Combine items across every selected order and fetch product weight/dimensions,
    // exactly like the checkout route does, to run the same shipping calculation once
    // over the combined package.
    const combinedItems = orders.flatMap((o) =>
      Array.isArray(o.items) ? (o.items as unknown as OrderItemSnapshot[]) : []
    );
    const productIds = Array.from(
      new Set(
        combinedItems
          .map((i) => i.id)
          .filter((id): id is string => typeof id === 'string')
          .map(getBaseProductId)
      )
    );
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, weightGrams: true, lengthCm: true, widthCm: true, heightCm: true },
    });
    const shippingItems = combinedItems.map((item) => {
      const product = products.find((p) => p.id === getBaseProductId(item.id ?? ''));
      return {
        quantity: item.quantity ?? 1,
        weightGrams: product?.weightGrams ?? null,
        lengthCm: product?.lengthCm ?? null,
        widthCm: product?.widthCm ?? null,
        heightCm: product?.heightCm ?? null,
      };
    });

    const shippingCost = resolveShippingCost(
      shippingItems,
      referenceOrder.shippingPostalCode,
      merchandiseTotal,
      SHIPPING_CONFIG.freeShippingThreshold
    );

    // Lets the UI warn the customer about the fee before anything is created or charged.
    if (isPreview) {
      return NextResponse.json({
        preview: true,
        merchandiseTotal,
        shippingCost,
        freeShippingThreshold: SHIPPING_CONFIG.freeShippingThreshold,
      });
    }

    const shipmentNumber = await generateShipmentNumber();

    // Atomic claim: the shipment row is created AND the orders are claimed
    // (guarded by shipmentId IS NULL) inside the same transaction. If a concurrent
    // request already claimed one of these orders, the updateMany count won't match
    // and we throw, rolling back the whole transaction — no duplicate shipments.
    let shipmentId: string;
    try {
      const created = await db.$transaction(async (tx) => {
        const shipment = await tx.shipment.create({
          data: {
            shipmentNumber,
            userId,
            merchandiseTotal: String(merchandiseTotal),
            shippingCost: String(shippingCost),
            paymentStatus: shippingCost > 0 ? 'PENDING_PAYMENT' : 'PAID',
            paymentPaidAt: shippingCost > 0 ? null : new Date(),
          },
        });

        const claim = await tx.order.updateMany({
          where: {
            id: { in: orderIds },
            userId,
            shipmentId: null,
            shippingMode: 'GROUPED',
            paymentStatus: 'PAID',
            status: 'PROCESSING',
          },
          data: { shipmentId: shipment.id },
        });

        if (claim.count !== orderIds.length) {
          throw new Error('SHIPMENT_CLAIM_CONFLICT');
        }

        return shipment;
      });
      shipmentId = created.id;
    } catch (error) {
      if (error instanceof Error && error.message === 'SHIPMENT_CLAIM_CONFLICT') {
        return NextResponse.json(
          { error: 'Uno o más pedidos ya han sido incluidos en otra solicitud de envío.' },
          { status: 409 }
        );
      }
      throw error;
    }

    // Free shipping (combined value reached the threshold) — nothing to pay, so notify sales
    // now. When a fee is owed, the email is sent only after Redsys confirms the payment
    // (see handleShipmentPaymentSuccess).
    if (shippingCost <= 0) {
      await notifyShipmentRequested(shipmentId);
      return NextResponse.json({
        success: true,
        shipmentNumber,
        shippingCost: 0,
        requiresPayment: false,
      });
    }

    // Shipping fee owed — create a single Redsys payment for it only.
    const config = getRedsysConfig();
    const redsysOrderId = await nextRedsysOrderId();

    await db.shipment.update({
      where: { id: shipmentId },
      data: { redsysOrderId, paymentProvider: 'redsys' },
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const notificationUrl =
      process.env.REDSYS_NOTIFICATION_URL || `${origin}/api/payments/redsys/notification`;

    const merchantParams: RedsysMerchantParameters = {
      DS_MERCHANT_AMOUNT: String(Math.round(shippingCost * 100)),
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_ORDER: redsysOrderId,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: `${origin}/checkout/payment/shipment-success?shipment=${shipmentNumber}`,
      DS_MERCHANT_URLKO: `${origin}/checkout/payment/shipment-error?shipment=${shipmentNumber}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '1',
    };

    const merchantParametersBase64 = toBase64(JSON.stringify(merchantParams));
    const signature = generateSignature(merchantParametersBase64, redsysOrderId);

    return NextResponse.json({
      success: true,
      shipmentNumber,
      shippingCost,
      requiresPayment: true,
      Ds_MerchantParameters: merchantParametersBase64,
      Ds_Signature: signature,
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      url: getRedsysApiUrl(),
    });
  } catch (error) {
    captureServerError({ error, module: 'shipments_request_api', request });
    return NextResponse.json({ error: 'Error al solicitar el envío agrupado.' }, { status: 500 });
  }
}
