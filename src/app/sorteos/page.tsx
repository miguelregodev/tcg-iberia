import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { listPublicLotteries } from '@/lib/lottery/service';
import { LOTTERY_STATUS_LABELS, type LotteryStatus } from '@/lib/lottery/core';

export const metadata = {
  title: 'Sorteos | TCG Iberia',
  description: 'Participa en los sorteos de TCG Iberia con tu pedido.',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function SorteosPage() {
  const lotteries = await listPublicLotteries();

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg px-4 py-12 text-text-primary">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-bold">Sorteos</h1>
          <p className="mt-2 text-text-secondary">Participa con tu pedido y consulta los sorteos activos.</p>

          {lotteries.length === 0 ? (
            <p className="mt-10 text-text-muted">Ahora mismo no hay sorteos disponibles.</p>
          ) : (
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {lotteries.map((lottery) => (
                <li key={lottery.id} className="rounded-xl border border-dark-border bg-dark-surface p-6">
                  <span className="text-xs font-medium uppercase tracking-wide text-premium-gold">
                    {LOTTERY_STATUS_LABELS[lottery.status as LotteryStatus]}
                  </span>
                  <h2 className="mt-2 text-xl font-semibold">{lottery.title}</h2>
                  <p className="mt-1 text-text-secondary">Premio: {lottery.prize}</p>
                  <p className="mt-2 text-sm text-text-muted">
                    {DATE_FORMAT.format(new Date(lottery.startDate))} – {DATE_FORMAT.format(new Date(lottery.endDate))}
                  </p>
                  <Link
                    href={`/sorteos/${lottery.slug}`}
                    className="btn btn-primary mt-5 inline-flex"
                  >
                    Ver sorteo<span className="sr-only"> {lottery.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
