'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { LoginModal } from '@/components/LoginModal';
import { PARTY_MODE_INFO, type PartyMode } from '@/lib/parties/core';

interface Party {
  id: string;
  product: { name: string; slug: string; imageUrl: string | null; language: string };
  boxPrice: number;
  participationPrice: number;
  packsPerBox: number;
  participantCount: number;
  packsPerParticipant: number;
  mode: PartyMode;
  status: string;
  tiktokLiveUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
  paidCount: number;
  pendingCount: number;
  winnerName: string | null;
  hasParticipation: boolean;
  slots: Array<{ slotNumber: number; status: string; displayName: string | null }>;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Abierta',
  FULL: 'Completa — pendiente de directo',
  IN_PROGRESS: 'Party Iniciada',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

const LANGUAGE_LABEL: Record<string, string> = {
  JAPANESE: 'Japonés',
  KOREAN: 'Coreano',
  ENGLISH: 'Inglés',
  SPANISH: 'Español',
  CHINESE: 'Chino',
};

export default function PartyDetailClient({ partyId }: { partyId: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadParty = useCallback(async () => {
    const response = await fetch(`/api/parties/${partyId}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo cargar la Party.');
    setParty(data.party as Party);
  }, [partyId]);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    setLoading(true);
    loadParty()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Error al cargar la Party.'))
      .finally(() => setLoading(false));
  }, [loadParty, sessionStatus, session?.user?.id]);

  const participate = async () => {
    if (!session?.user) {
      setShowLogin(true);
      return;
    }
    if (party?.hasParticipation || working) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/parties/${partyId}/participate`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el pago.');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.url;
      for (const [name, value] of Object.entries({
        Ds_SignatureVersion: data.Ds_SignatureVersion,
        Ds_MerchantParameters: data.Ds_MerchantParameters,
        Ds_Signature: data.Ds_Signature,
      })) {
        if (typeof value !== 'string') throw new Error('La pasarela de pago devolvió datos incompletos.');
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Error al iniciar el pago.');
      await loadParty();
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg py-12">
        <div className="container-custom px-4 max-w-5xl">
          <Link href="/parties" className="text-premium-gold hover:underline">← Volver a Parties</Link>
          {loading && <p role="status" className="mt-8 text-text-secondary">Cargando Party…</p>}
          {error && <p role="alert" className="mt-5 text-danger">{error}</p>}
          {!loading && party && (
            <article className="mt-6 rounded-2xl border border-dark-border bg-dark-surface overflow-hidden">
              <div className="grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="bg-dark-bgSecondary min-h-64 flex items-center justify-center p-8">
                  {party.product.imageUrl ? (
                    <img src={party.product.imageUrl} alt={party.product.name} className="max-h-96 w-full object-contain" />
                  ) : (
                    <span className="text-text-secondary">Imagen no disponible</span>
                  )}
                </div>
                <div className="p-6 sm:p-9">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <p className="text-premium-gold font-semibold">{STATUS_LABEL[party.status] ?? party.status}</p>
                    <p className="text-sm text-text-secondary">{LANGUAGE_LABEL[party.product.language] ?? party.product.language}</p>
                  </div>
                  <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-text-primary">{party.product.name}</h1>
                  <div className="mt-4 rounded-lg border border-premium-gold/30 bg-premium-gold/10 p-4">
                    <p className="font-bold text-premium-gold">Party {PARTY_MODE_INFO[party.mode].label}</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      {party.mode === 'SHARED'
                        ? `Compras ${party.packsPerParticipant} sobre(s) de la caja y son para ti: los abrimos en directo y puedes solicitar su envío cuando la Party finalice, solo o agrupado con otros pedidos.`
                        : `Cada participante abre ${party.packsPerParticipant} sobre(s) en directo. Quien consiga el mejor hit se lleva todos los sobres de la apertura (${party.packsPerBox}).`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-7">
                    <p className="text-sm text-text-secondary">Precio de la caja<strong className="block mt-1 text-lg text-text-primary">{party.boxPrice.toFixed(2)} €</strong></p>
                    <p className="text-sm text-text-secondary">Participación<strong className="block mt-1 text-lg text-premium-gold">{party.participationPrice.toFixed(2)} €</strong></p>
                    <p className="text-sm text-text-secondary">Packs en la caja<strong className="block mt-1 text-text-primary">{party.packsPerBox}</strong></p>
                    <p className="text-sm text-text-secondary">{party.mode === 'SHARED' ? 'Tus packs' : 'Packs por participante'}<strong className="block mt-1 text-text-primary">{party.packsPerParticipant}</strong></p>
                  </div>
                  <p className="mt-6 text-text-secondary">
                    Plazas con pago confirmado: <strong className="text-text-primary">{party.paidCount}/{party.participantCount}</strong>
                    {party.pendingCount > 0 && <span className="ml-2 text-amber-300">({party.pendingCount} pago(s) pendiente(s))</span>}
                  </p>

                  <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 gap-3" aria-label="Plazas de participantes">
                    {party.slots.map((slot) => (
                      <div key={slot.slotNumber} className="text-center">
                        <div
                          aria-label={`Plaza ${slot.slotNumber}: ${slot.status === 'PAID' ? 'pago confirmado' : slot.status === 'PENDING' ? 'pago pendiente' : 'disponible'}`}
                          className={`aspect-square rounded-lg border-2 flex items-center justify-center text-sm font-bold ${
                            slot.status === 'PAID'
                              ? 'border-green-500 bg-green-600 text-white'
                              : slot.status === 'PENDING'
                                ? 'border-amber-500 bg-amber-500/25 text-amber-200'
                                : 'border-gray-500 bg-gray-600/50 text-gray-300'
                          }`}
                        >
                          {slot.slotNumber}
                        </div>
                        {slot.status === 'PAID' && slot.displayName && (
                          <span className="block mt-1 text-xs text-text-secondary truncate">{slot.displayName}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {party.status === 'OPEN' && (
                    <div className="mt-7">
                      {sessionStatus === 'unauthenticated' ? (
                        <div className="rounded-lg border border-dark-border p-4">
                          <p className="text-text-secondary">Para participar en las Parties, debes registrarte o iniciar sesión.</p>
                          <div className="mt-3 flex flex-wrap gap-4">
                            <Link href="/registro" className="text-premium-gold underline">Registrarme</Link>
                            <button type="button" onClick={() => setShowLogin(true)} className="text-premium-gold underline">Iniciar sesión</button>
                          </div>
                          <button type="button" disabled className="btn btn-primary mt-4 opacity-50 cursor-not-allowed">
                            Participar en la Party
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={participate}
                          disabled={party.hasParticipation || working || sessionStatus === 'loading' || party.paidCount + party.pendingCount >= party.participantCount}
                          className="btn btn-primary disabled:opacity-50"
                        >
                          {party.hasParticipation ? 'Ya tienes una participación' : working ? 'Preparando pago…' : 'Participar en la Party'}
                        </button>
                      )}
                      <p className="mt-3 text-sm text-text-secondary">
                        Solo puedes comprar una participación por Party.
                      </p>
                    </div>
                  )}
                  {party.status === 'FULL' && (
                    <p className="mt-7 rounded-lg border border-premium-gold/30 bg-premium-gold/10 p-4 text-premium-gold">
                      Todas las participaciones se han vendido. La Party está pendiente de la sesión en directo.
                    </p>
                  )}
                  {party.status === 'IN_PROGRESS' && (
                    <div className="mt-7 rounded-lg border border-red-500/40 bg-red-950/30 p-5">
                      <p className="font-bold text-text-primary">Party Iniciada</p>
                      <p className="mt-2 text-text-secondary">Puedes ver la apertura y {party.mode === 'SHARED' ? 'tus sobres' : 'quién consigue el mejor hit'} en TikTok LIVE.</p>
                      {party.tiktokLiveUrl && (
                        <a href={party.tiktokLiveUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex mt-4">
                          Ver directo en TikTok
                        </a>
                      )}
                    </div>
                  )}
                  {party.status === 'COMPLETED' && (
                    <div className="mt-7 rounded-lg border border-green-600/40 bg-green-950/20 p-5">
                      <p className="font-bold text-text-primary">La apertura ha finalizado.</p>
                      {party.mode === 'BATTLE' ? (
                        <p className="mt-2 text-text-secondary">Mejor hit y ganador/a de todos los sobres: <strong className="text-green-300">{party.winnerName ?? 'Participante seleccionado'}</strong></p>
                      ) : (
                        <p className="mt-2 text-text-secondary">Cada participante conserva los sobres que ha comprado. Puedes solicitar su envío, solo o agrupado con otros pedidos, desde Mi cuenta → Pedidos.</p>
                      )}
                      {party.tiktokLiveUrl && (
                        <a href={party.tiktokLiveUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-premium-gold underline">
                          Ver el directo en TikTok
                        </a>
                      )}
                    </div>
                  )}
                  {party.status === 'CANCELLED' && (
                    <p className="mt-7 rounded-lg border border-gray-500/40 bg-gray-700/20 p-4 text-text-secondary">
                      Esta Party ha sido cancelada y ya no admite participaciones.
                    </p>
                  )}
                  <p className="mt-5 text-xs text-text-secondary">
                    El pago solo confirma una plaza cuando TCG Iberia recibe la confirmación segura del proveedor de pago.
                    Las participaciones no incluyen un envío individual; el envío de los sobres se solicita después de la apertura.
                  </p>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>
      <Footer />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
