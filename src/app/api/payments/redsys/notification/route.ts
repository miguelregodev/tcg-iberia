/**
 * POST /api/payments/redsys/notification
 *
 * Receives server-to-server payment notifications from Redsys.
 *
 * This endpoint is critical for payment confirmation. It:
 * 1. Parses the Redsys notification
 * 2. Verifies the signature (MANDATORY)
 * 3. Validates order and amount
 * 4. Updates order payment status
 * 5. Triggers post-payment business logic (stock, emails, analytics)
 * 6. Handles idempotency (duplicate notifications)
 *
 * Request format: application/x-www-form-urlencoded or multipart/form-data
 * {
 *   Ds_SignatureVersion: "HMAC_SHA256_V1",
 *   Ds_MerchantParameters: "<base64>",
 *   Ds_Signature: "<base64>"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { captureServerError } from '@/lib/observability/sentry';
import {
  parseRedsysNotificationPayload,
  decodeRedsysMerchantParameters,
  extractRedsysOrderNumber,
  extractRedsysResponseCode,
  extractRedsysTransactionReference,
  extractRedsysAuthCode,
  extractRedsysAmount,
  extractRedsysCurrency,
} from '@/lib/payments/redsys/parseNotification';
import {
  verifySignature,
} from '@/lib/payments/redsys/signature';
import {
  isRedsysResponseSuccess,
  isRedsysResponseCancelled,
} from '@/lib/payments/redsys/types';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
  verifyPaymentAmount,
} from '@/lib/payments/paymentService';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const formData = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }

    // Parse Redsys notification payload
    let notification;
    try {
      notification = parseRedsysNotificationPayload(body);
    } catch (error) {
      console.error('Failed to parse Redsys notification:', error);
      return NextResponse.json(
        { error: 'Invalid notification format' },
        { status: 400 }
      );
    }

    // Decode merchant parameters
    let params;
    try {
      params = decodeRedsysMerchantParameters(notification.Ds_MerchantParameters);
    } catch (error) {
      console.error('Failed to decode Redsys merchant parameters:', error);
      captureServerError({
        error,
        module: 'redsys_notification_decode',
        extra: {
          notification,
        },
      });
      return NextResponse.json(
        { error: 'Failed to decode parameters' },
        { status: 400 }
      );
    }

    // Extract order number
    let redsysOrderId;
    try {
      redsysOrderId = extractRedsysOrderNumber(params);
    } catch (error) {
      console.error('Failed to extract order number:', error);
      return NextResponse.json(
        { error: 'Missing order number' },
        { status: 400 }
      );
    }

    // Extract response code
    let responseCode;
    try {
      responseCode = extractRedsysResponseCode(params);
    } catch (error) {
      console.error('Failed to extract response code:', error);
      return NextResponse.json(
        { error: 'Missing response code' },
        { status: 400 }
      );
    }

    // Verify signature (CRITICAL)
    const isSignatureValid = verifySignature(
      notification.Ds_MerchantParameters,
      notification.Ds_Signature,
      redsysOrderId
    );

    if (!isSignatureValid) {
      console.error('Redsys signature verification failed', {
        redsysOrderId,
      });

      captureServerError({
        error: new Error('Redsys signature verification failed'),
        module: 'redsys_notification_signature',
        extra: {
          redsysOrderId,
          responseCode,
        },
      });

      // Return 200 OK to Redsys even though we rejected it (idempotency)
      // but log the error for investigation
      return NextResponse.json(
        { received: true },
        { status: 200 }
      );
    }

    // Find order by redsysOrderId
    const order = await db.order.findFirst({
      where: { redsysOrderId },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        totalAmount: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      console.error('Order not found', { redsysOrderId });

      captureServerError({
        error: new Error('Order not found for Redsys notification'),
        module: 'redsys_notification_order_lookup',
        extra: {
          redsysOrderId,
          responseCode,
        },
      });

      // Return 200 OK to Redsys (acknowledge receipt) but don't process
      return NextResponse.json(
        { received: true },
        { status: 200 }
      );
    }

    // Extract payment details from Redsys response
    const paymentAmount = extractRedsysAmount(params);
    const paymentCurrency = extractRedsysCurrency(params);
    const transactionId = extractRedsysTransactionReference(params);
    const authCode = extractRedsysAuthCode(params);

    // Verify payment amount matches order
    try {
      verifyPaymentAmount(order, paymentAmount, paymentCurrency);
    } catch (error) {
      console.error('Payment amount verification failed:', error);

      captureServerError({
        error,
        module: 'redsys_notification_amount_verify',
        extra: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          redsysOrderId,
          responseCode,
        },
      });

      // Mark order as failed due to amount mismatch
      await handlePaymentFailure({
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: 'Amount mismatch',
      });

      return NextResponse.json(
        { received: true },
        { status: 200 }
      );
    }

    // Handle payment result based on response code
    if (isRedsysResponseSuccess(responseCode)) {
      // Payment succeeded
      try {
        await handlePaymentSuccess({
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentAmount,
          paymentCurrency,
          transactionId,
        });

        // Update order with Redsys transaction details
        await db.order.update({
          where: { id: order.id },
          data: {
            redsysTransactionId: transactionId,
            redsysResponseCode: responseCode,
            redsysAuthCode: authCode,
          },
        });
      } catch (error) {
        console.error('Payment success handler failed:', error);

        captureServerError({
          error,
          module: 'redsys_notification_payment_success',
          extra: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            redsysOrderId,
            responseCode,
          },
        });

        // Still return 200 OK to Redsys; error is logged
        return NextResponse.json(
          { received: true },
          { status: 200 }
        );
      }
    } else if (isRedsysResponseCancelled(responseCode)) {
      // Payment cancelled by user
      try {
        await handlePaymentFailure({
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: 'User cancelled payment',
        });

        // Update order with Redsys details
        await db.order.update({
          where: { id: order.id },
          data: {
            redsysTransactionId: transactionId,
            redsysResponseCode: responseCode,
            paymentStatus: 'CANCELLED',
          },
        });
      } catch (error) {
        console.error('Payment cancellation handler failed:', error);

        captureServerError({
          error,
          module: 'redsys_notification_payment_cancelled',
          extra: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            redsysOrderId,
            responseCode,
          },
        });
      }
    } else {
      // Payment declined/error
      try {
        await handlePaymentFailure({
          orderId: order.id,
          orderNumber: order.orderNumber,
          reason: `Payment declined: ${responseCode}`,
        });

        // Update order with Redsys details
        await db.order.update({
          where: { id: order.id },
          data: {
            redsysTransactionId: transactionId,
            redsysResponseCode: responseCode,
            redsysAuthCode: authCode,
          },
        });
      } catch (error) {
        console.error('Payment failure handler failed:', error);

        captureServerError({
          error,
          module: 'redsys_notification_payment_declined',
          extra: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            redsysOrderId,
            responseCode,
          },
        });
      }
    }

    // Return 200 OK to Redsys to acknowledge receipt
    return NextResponse.json(
      { received: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Redsys notification handler error:', error);

    captureServerError({
      error,
      module: 'redsys_notification_handler',
    });

    // Return 200 OK to Redsys even on error (idempotency + acknowledgement)
    return NextResponse.json(
      { received: true },
      { status: 200 }
    );
  }
}

// Mark this route to use Node.js runtime (required for crypto operations)
export const runtime = 'nodejs';
