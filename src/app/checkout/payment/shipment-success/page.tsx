/**
 * GET /checkout/payment/shipment-success
 *
 * Landing page after paying a grouped-shipment fee (see /api/user/shipments/request).
 * Not authoritative — the Redsys server-to-server notification is what actually marks
 * the Shipment as PAID. This page just polls the customer's own shipment record.
 */
import ShipmentPaymentSuccessClient from './ShipmentPaymentSuccessClient';

export default async function ShipmentPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment?: string }>;
}) {
  const params = await searchParams;
  return <ShipmentPaymentSuccessClient shipmentNumber={params.shipment ?? null} />;
}
