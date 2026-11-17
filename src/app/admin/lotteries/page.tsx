'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { LOTTERY_STATUS_LABELS } from '@/lib/lottery/core';

interface LotteryRow {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  status: keyof typeof LOTTERY_STATUS_LABELS;
  participationCounts: { PENDING: number; APPROVED: number; REJECTED: number };
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
  SCHEDULED: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  ACTIVE: 'bg-success-bg text-success border-success/30',
  FINISHED: 'bg-warning-bg text-warning border-warning/30',
  DRAWN: 'bg-premium-gold/15 text-premium-gold border-premium-gold/30',
  CANCELLED: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default function AdminLotteriesPage() {
  const [lotteries, setLotteries] = useState<LotteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/lotteries')
      .then(async (response) => {
        const result = (await response.json()) as { lotteries?: LotteryRow[]; error?: string };
        if (!response.ok || !result.lotteries) throw new Error(result.error || 'No se pudieron cargar los sorteos.');
        setLotteries(result.lotteries);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Error al cargar los sorteos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Sorteos</h1>
          <Link href="/admin/lotteries/new" className="btn btn-primary">
            Nuevo sorteo
          </Link>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-text-muted">Cargando sorteos...</p>
        ) : lotteries.length === 0 ? (
          <p className="text-text-muted">Todavía no hay sorteos.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-dark-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-dark-surface text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Título</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Periodo (Madrid)</th>
                  <th className="px-4 py-3 font-medium">Participaciones</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {lotteries.map((lottery) => (
                  <tr key={lottery.id} className="bg-dark-bg">
                    <td className="px-4 py-3 font-medium">{lottery.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[lottery.status] ?? ''}`}>
                        {LOTTERY_STATUS_LABELS[lottery.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {DATE_FORMAT.format(new Date(lottery.startDate))} – {DATE_FORMAT.format(new Date(lottery.endDate))}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {lottery.participationCounts.PENDING} pendientes · {lottery.participationCounts.APPROVED} aprobadas ·{' '}
                      {lottery.participationCounts.REJECTED} rechazadas
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/lotteries/${lottery.id}`} className="text-premium-gold underline-offset-4 hover:underline">
                        Gestionar<span className="sr-only"> {lottery.title}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
