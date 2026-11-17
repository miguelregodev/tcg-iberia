import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getPublicLotteryBySlug } from '@/lib/lottery/service';
import LotteryDetailClient from './LotteryDetailClient';

export default async function SorteoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [lottery, session] = await Promise.all([getPublicLotteryBySlug(slug), auth()]);
  if (!lottery) notFound();

  return (
    <LotteryDetailClient
      lottery={{
        ...lottery,
        startDate: lottery.startDate.toISOString(),
        endDate: lottery.endDate.toISOString(),
      }}
      isLoggedIn={Boolean(session?.user?.id)}
    />
  );
}
