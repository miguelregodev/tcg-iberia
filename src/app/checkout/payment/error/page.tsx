/**
 * GET /checkout/payment/error
 *
 * Payment error landing page
 *
 * Query params:
 * - order: Order number (customer-facing)
 * - reason: Error reason (optional)
 */

import CheckoutPaymentErrorClient from './CheckoutPaymentErrorClient';

export default async function CheckoutPaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const orderNumber = params.order ?? null;
  const reason = params.reason ?? null;

  return <CheckoutPaymentErrorClient orderNumber={orderNumber} reason={reason} />;
}
