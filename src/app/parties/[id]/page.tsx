import PartyDetailClient from './PartyDetailClient';

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PartyDetailClient partyId={id} />;
}
