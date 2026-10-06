import ShipmentPaymentErrorClient from './ShipmentPaymentErrorClient';

export default async function ShipmentPaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ shipment?: string }>;
}) {
  const params = await searchParams;
  return <ShipmentPaymentErrorClient shipmentNumber={params.shipment ?? null} />;
}
