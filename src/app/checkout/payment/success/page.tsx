/**
 * GET /checkout/payment/success
 *
 * Payment success landing page
 *
 * Query params:
 * - order: Order number (customer-facing)
 * - reference: Payment reference (alternative)
 *
 * This page is shown after customer returns from Redsys.
 * It queries the server for order status and payment confirmation.
 *
 * IMPORTANT: This page is NOT authoritative for payment status.
 * The Redsys notification webhook is the authoritative source.
 * If notification hasn't arrived yet, show "confirming" state with polling.
 */

import CheckoutPaymentSuccessClient from './CheckoutPaymentSuccessClient';

export default async function CheckoutPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  const orderNumber = params.order ?? null;

  return <CheckoutPaymentSuccessClient orderNumber={orderNumber} />;
}
