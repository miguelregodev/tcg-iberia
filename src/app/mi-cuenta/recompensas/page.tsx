import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { calculateTierProgress } from '@/lib/loyalty/calculations';
import { getLocalAccount } from '@/lib/loyalty/ledger';
import { isLoyaltyCheckoutEnabled, isLoyaltyEnabled } from '@/lib/loyalty/local-preview';
import { formatLoyaltyPoints, serializeTierTrack } from '@/lib/loyalty/presentation';
import { LoyaltyTierProgress } from '@/components/LoyaltyTierProgress';

export const dynamic = 'force-dynamic';

function formatDecimal(value: Prisma.Decimal): string {
  const [whole, fraction] = value.toFixed(2).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function RewardsPage() {
  const session = await auth();
  if (!isLoyaltyEnabled() || !session?.user?.id) {
    return <p className="text-text-secondary">El programa de recompensas no está disponible.</p>;
  }

  try {
    const data = await db.$transaction((tx) => getLocalAccount(tx, session.user.id, new Date()));
    const progress = calculateTierProgress(data.config.tiers, data.spending);
    const available = Prisma.Decimal.max(data.balance.minus(data.reserved), 0);
    const value = available.dividedBy(data.config.pointsPerEuro).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Recompensas</h1>
          <p className="mt-2 text-text-secondary">
            {isLoyaltyCheckoutEnabled() ? 'Gana puntos con cada compra y canjéalos como descuento en el checkout.' : 'Las compras y los canjes de puntos todavía no están activos.'}
          </p>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold text-text-primary">Saldo de puntos</h2>
          <p className="mt-2 text-3xl font-bold text-premium-gold">{formatLoyaltyPoints(available.toString())} puntos</p>
          <p className="mt-2 text-text-secondary">Valor {isLoyaltyCheckoutEnabled() ? 'disponible' : 'teórico'}: {formatDecimal(value)} €.</p>
          {data.reserved.greaterThan(0) && <p className="mt-2 text-text-secondary">Puntos reservados en pagos pendientes: {formatLoyaltyPoints(data.reserved.toString())}</p>}
          {data.balance.isNegative() && <p className="mt-2 text-text-secondary">Saldo negativo: {formatLoyaltyPoints(data.balance.toString())} puntos.</p>}
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold text-text-primary">{progress.current.name} · x{progress.current.multiplier.toString()} Puntos</h2>
          <p className="mt-2 text-text-secondary">Gasto elegible en {data.config.evaluationDays} días: {formatDecimal(data.spending)} €</p>
          {progress.next ? (
            <>
              <p className="mt-2 text-text-secondary">Faltan {formatDecimal(progress.remaining)} € para {progress.next.name}.</p>
            </>
          ) : <p className="mt-2 text-text-secondary">Has alcanzado el nivel máximo.</p>}
          <LoyaltyTierProgress tiers={serializeTierTrack(data.config.tiers)} currentTier={progress.current.name} progress={progress.percentage.toNumber()} />
        </div>
        <div className="card overflow-hidden">
          <h2 className="p-6 text-lg font-bold text-text-primary">Historial de puntos</h2>
          {data.transactions.length === 0 ? <p className="px-6 pb-6 text-text-secondary">Todavía no hay movimientos.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-y border-dark-border text-text-secondary"><th className="p-3">Fecha</th><th className="p-3">Descripción</th><th className="p-3">Puntos</th><th className="p-3">Saldo</th></tr></thead>
                <tbody>
                  {data.transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-dark-border text-text-primary">
                      <td className="p-3 whitespace-nowrap">{dateFormatter.format(transaction.createdAt)}</td>
                      <td className="p-3">{transaction.description}</td>
                      <td className="p-3">{formatLoyaltyPoints(transaction.points.toString())}</td>
                      <td className="p-3">{formatLoyaltyPoints(transaction.balanceAfter.toString())}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { module: 'loyalty_account_preview' } });
    return <p role="alert" className="text-text-secondary">No se pudieron cargar tus recompensas. Inténtalo de nuevo más tarde.</p>;
  }
}
