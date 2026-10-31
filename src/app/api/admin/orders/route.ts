import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';
import { sendShippingNotificationEmail } from '@/lib/email';
import { ShippingProvider } from '@/lib/shipping/tracking-urls';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { ownsPartyPrize } from '@/lib/parties/core';

const VALID_ORDER_STATUS = ['PROCESSING', 'SHIPPED', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEVUELTO'] as const;
type OrderStatus = (typeof VALID_ORDER_STATUS)[number];

const VALID_SHIPPING_PROVIDERS = ['CORREOS', 'MRW', 'SEUR', 'CTT_EXPRESS'] as const;
type ShippingProviderType = (typeof VALID_SHIPPING_PROVIDERS)[number];

function isAuthenticated(request: NextRequest): boolean {
  return isAdminAuthenticated(request);
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSizeRaw = parseInt(searchParams.get('pageSize') || '10', 10) || 10;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const search = searchParams.get('search')?.trim();
    const statusFilter = searchParams.get('status')?.trim();
    const paymentStatusFilter = searchParams.get('paymentStatus')?.trim();

    const skip = (page - 1) * pageSize;

    const conditions: any[] = [];
    if (search) {
      conditions.push({ orderNumber: { contains: search, mode: 'insensitive' as const } });
    }
    if (statusFilter && VALID_ORDER_STATUS.includes(statusFilter as OrderStatus)) {
      conditions.push({ status: statusFilter as OrderStatus });
    }
    if (paymentStatusFilter && ['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'].includes(paymentStatusFilter)) {
      conditions.push({ paymentStatus: paymentStatusFilter });
    }

    const where = conditions.length > 0 ? { AND: conditions } : undefined;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          shipment: {
            select: {
              shipmentNumber: true,
              shippingCost: true,
              merchandiseTotal: true,
              paymentStatus: true,
              orders: { select: { id: true, orderNumber: true, status: true } },
            },
          },
          partyParticipation: {
            select: {
              id: true,
              status: true,
              shippingRequestedAt: true,
              party: { select: { id: true, status: true, mode: true, winnerParticipationId: true } },
            },
          },
        },
      }),
      db.order.count({ where }),
    ]);

    const serialized = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      fullName: o.fullName,
      email: o.email,
      phone: o.phone,
      shippingAddress: o.shippingAddress,
      shippingPostalCode: o.shippingPostalCode,
      shippingCity: o.shippingCity,
      shippingLocality: o.shippingLocality,
      shippingProvince: o.shippingProvince,
      totalAmount: parseFloat(o.totalAmount.toString()),
      status: o.status,
      shippingProvider: o.shippingProvider,
      trackingNumber: o.trackingNumber,
      shippedAt: o.shippedAt,
      stripeSessionId: o.stripeSessionId,
      paymentStatus: o.paymentStatus,
      paymentProvider: o.paymentProvider,
      redsysOrderId: o.redsysOrderId,
      redsysTransactionId: o.redsysTransactionId,
      redsysAuthCode: o.redsysAuthCode,
      paymentPaidAt: o.paymentPaidAt,
      items: o.items,
      shippingMode: o.shippingMode,
      shipmentId: o.shipmentId,
      shipment: o.shipment
        ? {
            shipmentNumber: o.shipment.shipmentNumber,
            shippingCost: parseFloat(o.shipment.shippingCost.toString()),
            merchandiseTotal: parseFloat(o.shipment.merchandiseTotal.toString()),
            paymentStatus: o.shipment.paymentStatus,
            orders: o.shipment.orders,
          }
        : null,
      partyParticipation: o.partyParticipation
        ? {
            status: o.partyParticipation.status,
            shippingRequestedAt: o.partyParticipation.shippingRequestedAt,
            partyId: o.partyParticipation.party.id,
            partyStatus: o.partyParticipation.party.status,
            partyMode: o.partyParticipation.party.mode,
            isWinner:
              o.partyParticipation.party.winnerParticipationId === o.partyParticipation.id,
          }
        : null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json({
      orders: serialized,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    console.error('GET /api/admin/orders error', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      orderId?: string;
      status?: string;
      shippingProvider?: string;
      trackingNumber?: string;
    };
    const orderId = body.orderId?.trim();
    const status = body.status as OrderStatus | undefined;
    const shippingProvider = body.shippingProvider?.trim();
    const trackingNumber = body.trackingNumber?.trim();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!status || !VALID_ORDER_STATUS.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate shipping details when transitioning to SHIPPED
    if (status === 'SHIPPED') {
      if (!shippingProvider) {
        return NextResponse.json(
          { error: 'El proveedor logístico es obligatorio para marcar el pedido como enviado.' },
          { status: 400 }
        );
      }

      if (!VALID_SHIPPING_PROVIDERS.includes(shippingProvider as ShippingProviderType)) {
        return NextResponse.json(
          { error: 'Proveedor logístico inválido.' },
          { status: 400 }
        );
      }

      if (!trackingNumber) {
        return NextResponse.json(
          { error: 'El número de tracking es obligatorio para marcar el pedido como enviado.' },
          { status: 400 }
        );
      }
    }

    // Fetch current order to check state
    const currentOrder = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        fullName: true,
        status: true,
        shippingProvider: true,
        shipmentId: true,
        shipment: { select: { paymentStatus: true } },
        partyParticipation: {
          select: {
            id: true,
            shippingRequestedAt: true,
            party: { select: { status: true, mode: true, winnerParticipationId: true } },
          },
        },
      },
    });

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const partyOrder = currentOrder.partyParticipation;
    const ownsPrize = partyOrder
      ? ownsPartyPrize(partyOrder.party.mode, partyOrder.party.winnerParticipationId, partyOrder.id)
      : false;
    if (
      partyOrder &&
      ((status === 'SHIPPED' &&
        (partyOrder.party.status !== 'COMPLETED' ||
          !ownsPrize ||
          !partyOrder.shippingRequestedAt ||
          !currentOrder.shipmentId ||
          currentOrder.shipment?.paymentStatus !== 'PAID')) ||
        (status === 'COMPLETED' && ownsPrize && currentOrder.status !== 'SHIPPED'))
    ) {
      return NextResponse.json(
        { error: 'La orden de una Party solo puede enviarse tras la solicitud de quien recibe los sobres y no puede marcarse entregada antes del envío.' },
        { status: 409 },
      );
    }

    // Check if we're transitioning from PROCESSING to SHIPPED (to send email)
    const shouldSendShippingEmail = currentOrder.status === 'PROCESSING' && status === 'SHIPPED';

    // Update order
    const updateData: any = { status };
    if (status === 'SHIPPED') {
      updateData.shippingProvider = shippingProvider;
      updateData.trackingNumber = trackingNumber;
      updateData.shippedAt = new Date();
    }

    // Orders consolidated into a grouped shipment must ship together: reuse the exact
    // same status/provider/tracking fields, just applied to every order in the group,
    // instead of duplicating a separate shipment-level tracking system. Cancelled/failed
    // siblings are excluded so they can never be force-marked as shipped.
    let siblingOrdersToEmail: Array<{ orderNumber: string; email: string; fullName: string }> = [];
    let updated;
    if (status === 'SHIPPED' && currentOrder.shipmentId) {
      const groupOrders = await db.order.findMany({
        where: { shipmentId: currentOrder.shipmentId, status: { notIn: ['CANCELLED', 'FAILED'] } },
        select: { id: true, orderNumber: true, email: true, fullName: true, status: true },
      });
      siblingOrdersToEmail = groupOrders.filter((o) => o.status === 'PROCESSING');

      await db.order.updateMany({
        where: { shipmentId: currentOrder.shipmentId, status: { notIn: ['CANCELLED', 'FAILED'] } },
        data: updateData,
      });
      updated = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    } else {
      updated = await db.order.update({
        where: { id: orderId },
        data: updateData,
      });
    }

    // Send shipping notification email only if transitioning to SHIPPED from PROCESSING
    if (shouldSendShippingEmail) {
      const recipients = siblingOrdersToEmail.length > 0 ? siblingOrdersToEmail : [updated];
      for (const recipient of recipients) {
        try {
          await sendShippingNotificationEmail({
            orderNumber: recipient.orderNumber,
            fullName: recipient.fullName,
            email: recipient.email,
            shippingProvider: updated.shippingProvider || 'UNKNOWN',
            trackingNumber: updated.trackingNumber || 'UNKNOWN',
          });
        } catch (emailError) {
          console.error(
            `[admin_orders_api] Failed to send shipping notification email for order ${recipient.orderNumber}:`,
            emailError
          );
          // Don't fail the entire request if email fails - just log it
          captureServerError({
            error: emailError,
            module: 'admin_orders_shipping_email_failure',
            extra: {
              orderNumber: recipient.orderNumber,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message:
        status === 'SHIPPED'
          ? currentOrder.shipmentId
            ? 'Pedido(s) del envío agrupado marcados como enviados correctamente.'
            : 'Pedido marcado como enviado correctamente.'
          : undefined,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        shippingAddress: updated.shippingAddress,
        shippingPostalCode: updated.shippingPostalCode,
        shippingCity: updated.shippingCity,
        shippingLocality: updated.shippingLocality,
        shippingProvince: updated.shippingProvince,
        totalAmount: parseFloat(updated.totalAmount.toString()),
        status: updated.status,
        shippingProvider: updated.shippingProvider,
        trackingNumber: updated.trackingNumber,
        shippedAt: updated.shippedAt,
        items: updated.items,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    captureServerError({
      error,
      module: 'admin_orders_patch_api',
      request,
    });
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 },
    );
  }
}
