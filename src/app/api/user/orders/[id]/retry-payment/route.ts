/**
 * POST /api/user/orders/[id]/retry-payment
 *
 * Re-issues a fresh Redsys payment for an order that's still PENDING_PAYMENT —
 * e.g. the customer closed the Redsys tab without completing the original attempt.
 * Ownership is re-verified server-side; never trusts the id alone. Mirrors
 * /api/user/shipments/[id]/retry-payment but for the order's own total.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { captureServerError } from '@/lib/observability/sentry';
import { nextRedsysOrderId } from '@/lib/payments/redsys/orderId';
import { getRedsysConfig, getRedsysApiUrl } from '@/lib/payments/redsys/config';
import { generateSignature, toBase64 } from '@/lib/payments/redsys/signature';
import type { RedsysMerchantParameters } from '@/lib/payments/redsys/types';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { id } = await params;
    const order = await db.order.findUnique({ where: { id } });

    if (!order || (order.userId !== session.user.id && order.email !== session.user.email)) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    if (order.paymentStatus !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Este pedido no tiene un pago pendiente.' },
        { status: 409 }
      );
    }

    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Este pedido está cancelado y no se puede pagar.' },
        { status: 409 }
      );
    }

    const totalAmount = parseFloat(order.totalAmount.toString());
    const totalAmountCents = Math.round(totalAmount * 100);
    const config = getRedsysConfig();
    const redsysOrderId = await nextRedsysOrderId();

    await db.order.update({
      where: { id: order.id },
      data: {
        redsysOrderId,
        paymentProvider: 'redsys',
        // Clear any stale attempt data left over from the previous try.
        redsysTransactionId: null,
        redsysResponseCode: null,
        redsysAuthCode: null,
      },
    });

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const notificationUrl =
      process.env.REDSYS_NOTIFICATION_URL || `${origin}/api/payments/redsys/notification`;

    const merchantParams: RedsysMerchantParameters = {
      DS_MERCHANT_AMOUNT: String(totalAmountCents),
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_ORDER: redsysOrderId,
      DS_MERCHANT_MERCHANTCODE: config.merchantCode,
      DS_MERCHANT_TERMINAL: config.terminal,
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_MERCHANTURL: notificationUrl,
      DS_MERCHANT_URLOK: `${origin}/checkout/payment/success?order=${order.orderNumber}`,
      DS_MERCHANT_URLKO: `${origin}/checkout/payment/error?order=${order.orderNumber}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '1',
    };

    const merchantParametersBase64 = toBase64(JSON.stringify(merchantParams));
    const signature = generateSignature(merchantParametersBase64, redsysOrderId);

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      totalAmount,
      requiresPayment: true,
      Ds_MerchantParameters: merchantParametersBase64,
      Ds_Signature: signature,
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      url: getRedsysApiUrl(),
    });
  } catch (error) {
    captureServerError({ error, module: 'orders_retry_payment_api', request });
    return NextResponse.json({ error: 'Error al reintentar el pago del pedido.' }, { status: 500 });
  }
}
