'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { PARTY_MODE_INFO, type PartyMode } from '@/lib/parties/core';

interface PartySummary {
  id: string;
  product: { name: string; slug: string; imageUrl: string | null; language: string };
  boxPrice: number;
  participationPrice: number;
  packsPerBox: number;
  participantCount: number;
  packsPerParticipant: number;
  mode: PartyMode;
  status: string;
  paidCount: number;
  createdAt: string;
  slots: Array<{ slotNumber: number; status: string; displayName: string | null }>;
}

const LANGUAGE_LABEL: Record<string, string> = {
  JAPANESE: 'Japonés',
  KOREAN: 'Coreano',
  ENGLISH: 'Inglés',
  SPANISH: 'Español',
  CHINESE: 'Chino',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierta',
  FULL: 'Completa — pendiente de directo',
  IN_PROGRESS: 'Party Iniciada',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

export default function PartiesClient() {
  const [parties, setParties] = useState<PartySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/parties')
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar las Parties.');
        const result = (await response.json()) as { parties: PartySummary[] };
        setParties(result.parties.filter((party) => party.status === 'OPEN'));
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Error al cargar las Parties.');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg py-12 sm:py-16">
        <div className="container-custom px-4">
          <header className="max-w-3xl mb-10">
            <p className="text-premium-gold font-semibold tracking-wide uppercase text-sm">TCG Iberia en directo</p>
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mt-2">Parties</h1>
            <p className="text-text-secondary mt-4">
              Únete a una Party, consigue tu plaza por una fracción del precio de la caja y cruza los dedos. Cuando todas las plazas estén pagadas, abriremos la booster box en directo y viviremos juntos la emoción de cada sobre.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-dark-border bg-dark-surface p-5">
                <h2 className="text-lg font-bold text-text-primary">Party Compartida</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  La caja se reparte entre todos los participantes: los sobres que compras con tu plaza son para ti. Abrimos tus sobres en directo y, después, puedes solicitar su envío, solo o agrupado con otros pedidos.
                </p>
              </div>
              <div className="rounded-xl border border-premium-gold/40 bg-dark-surface p-5">
                <h2 className="text-lg font-bold text-premium-gold">Party Batalla</h2>
                <p className="mt-2 text-sm text-text-secondary">
                  Todos los participantes abren sus sobres en directo y compiten por el mejor hit. ¡Quien consiga el mejor hit se lleva todos los sobres de la apertura!
                </p>
              </div>
            </div>
          </header>

          {loading && <p role="status" className="text-text-secondary">Cargando Parties…</p>}
          {error && <p role="alert" className="text-danger">{error}</p>}
          {!loading && !error && parties.length === 0 && (
            <div className="rounded-xl border border-dark-border bg-dark-surface p-8 text-text-secondary">
              Todavía no hay Parties disponibles. Vuelve pronto.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {parties.map((party) => (
              <article key={party.id} className="overflow-hidden rounded-2xl border border-dark-border bg-dark-surface">
                <Link href={`/parties/${party.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-premium-gold">
                  {party.product.imageUrl ? (
                    <img src={party.product.imageUrl} alt="" className="h-56 w-full object-contain bg-dark-bgSecondary p-4" />
                  ) : (
                    <div className="h-56 bg-dark-bgSecondary" aria-hidden="true" />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-text-primary">{party.product.name}</h2>
                        <p className="text-sm text-text-secondary mt-1">{LANGUAGE_LABEL[party.product.language] ?? party.product.language}</p>
                      </div>
                      <span className="rounded-full bg-dark-bg px-3 py-1 text-xs text-premium-gold">
                        {STATUS_LABEL[party.status] ?? party.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">
                      <span className="mr-2 rounded-full border border-premium-gold/40 px-2 py-0.5 text-xs font-semibold text-premium-gold">
                        {PARTY_MODE_INFO[party.mode].label}
                      </span>
                      {PARTY_MODE_INFO[party.mode].summary}
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
                      <p className="text-text-secondary">Caja <strong className="block text-text-primary">{party.boxPrice.toFixed(2)} €</strong></p>
                      <p className="text-text-secondary">Por plaza <strong className="block text-premium-gold">{party.participationPrice.toFixed(2)} €</strong></p>
                      <p className="text-text-secondary">Packs por caja <strong className="block text-text-primary">{party.packsPerBox}</strong></p>
                      <p className="text-text-secondary">Packs por persona <strong className="block text-text-primary">{party.packsPerParticipant}</strong></p>
                    </div>
                    <p className="mt-4 text-sm text-text-secondary">
                      Plazas confirmadas: <strong className="text-text-primary">{party.paidCount}/{party.participantCount}</strong>
                    </p>
                    <div className="mt-3 grid grid-cols-5 gap-2" aria-label={`${party.paidCount} de ${party.participantCount} plazas confirmadas`}>
                      {party.slots.map((slot) => (
                        <span
                          key={slot.slotNumber}
                          title={`Plaza ${slot.slotNumber}: ${slot.status === 'PAID' ? 'confirmada' : slot.status === 'PENDING' ? 'pago pendiente' : 'disponible'}`}
                          className={`aspect-square rounded-md border ${
                            slot.status === 'PAID'
                              ? 'border-green-500 bg-green-600'
                              : slot.status === 'PENDING'
                                ? 'border-amber-500 bg-amber-500/30'
                                : 'border-gray-500 bg-gray-600/50'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="btn btn-primary inline-flex mt-5">Ver detalles</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
