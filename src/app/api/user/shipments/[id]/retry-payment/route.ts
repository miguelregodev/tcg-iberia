/**
 * POST /api/user/shipments/[id]/retry-payment
 *
 * Re-issues a fresh Redsys payment for a shipment fee that's still PENDING_PAYMENT —
 * e.g. the customer closed the Redsys tab without completing or cancelling the
 * original attempt. Ownership is re-verified server-side; never trusts the id alone.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { captureServerError } from '@/lib/observability/sentry';
import { nextRedsysOrderId } from '@/lib/shipments/numbers';
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
    const shipment = await db.shipment.findUnique({ where: { id } });

    if (!shipment || shipment.userId !== session.user.id) {
      return NextResponse.json({ error: 'Envío no encontrado.' }, { status: 404 });
    }

    if (shipment.paymentStatus !== 'PENDING_PAYMENT') {
      return NextResponse.json(
        { error: 'Este envío no tiene un pago pendiente.' },
        { status: 409 }
      );
    }

    const shippingCost = parseFloat(shipment.shippingCost.toString());
    const config = getRedsysConfig();
    const redsysOrderId = await nextRedsysOrderId();

    await db.shipment.update({
      where: { id: shipment.id },
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
      DS_MERCHANT_URLOK: `${origin}/checkout/payment/shipment-success?shipment=${shipment.shipmentNumber}`,
      DS_MERCHANT_URLKO: `${origin}/checkout/payment/shipment-error?shipment=${shipment.shipmentNumber}`,
      DS_MERCHANT_CONSUMERLANGUAGE: '1',
    };

    const merchantParametersBase64 = toBase64(JSON.stringify(merchantParams));
    const signature = generateSignature(merchantParametersBase64, redsysOrderId);

    return NextResponse.json({
      success: true,
      shipmentNumber: shipment.shipmentNumber,
      shippingCost,
      requiresPayment: true,
      Ds_MerchantParameters: merchantParametersBase64,
      Ds_Signature: signature,
      Ds_SignatureVersion: 'HMAC_SHA256_V1',
      url: getRedsysApiUrl(),
    });
  } catch (error) {
    captureServerError({ error, module: 'shipments_retry_payment_api', request });
    return NextResponse.json({ error: 'Error al reintentar el pago del envío.' }, { status: 500 });
  }
}
