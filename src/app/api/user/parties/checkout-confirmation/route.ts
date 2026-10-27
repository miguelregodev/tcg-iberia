import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { captureServerError } from '@/lib/observability/sentry';
import { isSameOriginRequest } from '@/lib/security/request';
import {
  decodeRedsysMerchantParameters,
  extractRedsysOrderNumber,
  extractRedsysResponseCode,
} from '@/lib/payments/redsys/parseNotification';
import { verifySignature } from '@/lib/payments/redsys/signature';
import { processPartyParticipationPayment } from '@/lib/parties/payment';

// Applies the signed result Redsys appends to the OK URL, so the slot is confirmed on return
// even if the server-to-server notification is late. Unsigned/forged returns are rejected.
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 403 });
    }
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const body = (await request.json().catch(() => null)) as {
      participationId?: unknown;
      Ds_MerchantParameters?: unknown;
      Ds_Signature?: unknown;
    } | null;
    const participationId = typeof body?.participationId === 'string' ? body.participationId : '';
    const merchantParameters =
      typeof body?.Ds_MerchantParameters === 'string' ? body.Ds_MerchantParameters : '';
    const signature = typeof body?.Ds_Signature === 'string' ? body.Ds_Signature : '';
    if (!participationId || !merchantParameters || !signature) {
      return NextResponse.json({ error: 'Faltan datos de confirmación.' }, { status: 400 });
    }

    const participation = await db.partyParticipation.findFirst({
      where: { id: participationId, userId: session.user.id },
      select: { redsysOrderId: true },
    });
    if (!participation?.redsysOrderId) {
      return NextResponse.json({ error: 'Participación no encontrada.' }, { status: 404 });
    }

    const params = decodeRedsysMerchantParameters(merchantParameters);
    const redsysOrderId = extractRedsysOrderNumber(params);
    if (
      redsysOrderId !== participation.redsysOrderId ||
      !verifySignature(merchantParameters, signature, redsysOrderId)
    ) {
      return NextResponse.json({ error: 'Firma de pago no válida.' }, { status: 400 });
    }

    await processPartyParticipationPayment(
      redsysOrderId,
      extractRedsysResponseCode(params),
      params,
      request,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureServerError({ error, module: 'party_checkout_return_confirmation_api', request });
    return NextResponse.json({ error: 'No se pudo confirmar el pago.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }
    const participationId = request.nextUrl.searchParams.get('participation_id');
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!participationId && !sessionId) {
      return NextResponse.json({ error: 'Falta la referencia de pago.' }, { status: 400 });
    }
    const participation = await db.partyParticipation.findFirst({
      where: {
        userId: session.user.id,
        ...(participationId
          ? { id: participationId }
          : { stripeCheckoutSessionId: sessionId }),
      },
      select: {
        id: true,
        status: true,
        amountPaid: true,
        paidAt: true,
        order: { select: { orderNumber: true } },
        party: {
          select: {
            id: true,
            status: true,
            product: { select: { name: true, language: true } },
          },
        },
      },
    });
    if (!participation) return NextResponse.json({ partyPurchase: null });
    return NextResponse.json({
      partyPurchase: {
        id: participation.id,
        participationStatus: participation.status,
        confirmed: participation.status === 'PAID' && participation.paidAt !== null,
        amountPaid: Number(participation.amountPaid),
        orderNumber: participation.order?.orderNumber ?? null,
        party: {
          id: participation.party.id,
          status: participation.party.status,
          productName: participation.party.product.name,
          language: participation.party.product.language,
        },
      },
    });
  } catch (error) {
    captureServerError({ error, module: 'party_checkout_confirmation_api', request });
    return NextResponse.json({ error: 'No se pudo cargar la confirmación.' }, { status: 500 });
  }
}
