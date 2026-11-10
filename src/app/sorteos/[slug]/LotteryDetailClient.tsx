'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { LoginModal } from '@/components/LoginModal';
import { LOTTERY_STATUS_LABELS, type LotteryStatus } from '@/lib/lottery/core';

export interface PublicLottery {
  id: string;
  title: string;
  slug: string;
  prize: string;
  prizeImageUrl: string | null;
  description: string;
  startDate: string;
  endDate: string;
  minimumOrderAmount: number | null;
  status: LotteryStatus;
  winnerName: string | null;
}

interface LotteryDetailClientProps {
  lottery: PublicLottery;
  isLoggedIn: boolean;
}

const FINISHED_MESSAGE =
  '¡El sorteo ha finalizado! Los resultados se anunciarán en nuestro próximo directo de TikTok.';
const SUCCESS_MESSAGE =
  '¡Tu participación ha sido registrada correctamente! Nuestro equipo revisará los datos de tu pedido y recibirás un correo electrónico cuando tu participación haya sido validada.';

const FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-premium-gold disabled:opacity-60';

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'long' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Returns YYYY-MM-DD in Europe/Madrid, used as the min/max of the order date input. */
function toMadridDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

export default function LotteryDetailClient({ lottery, isLoggedIn }: LotteryDetailClientProps) {
  const [orderNumber, setOrderNumber] = useState('');
  const [platform, setPlatform] = useState<'TIKTOK' | 'WEBSITE' | ''>('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const minDate = useMemo(() => toMadridDate(lottery.startDate), [lottery.startDate]);
  const maxDate = useMemo(() => toMadridDate(lottery.endDate), [lottery.endDate]);

  const formOpen = lottery.status === 'ACTIVE';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/lotteries/${lottery.slug}/participate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          platform,
          tiktokUsername: platform === 'TIKTOK' ? tiktokUsername : undefined,
          orderDate,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.status === 401) {
        setShowLogin(true);
        return;
      }
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar la participación.');
      setSuccess(true);
      setOrderNumber('');
      setPlatform('');
      setTiktokUsername('');
      setOrderDate('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la participación.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusMessage = () => {
    switch (lottery.status) {
      case 'SCHEDULED':
        return <p className="text-text-secondary">El sorteo comenzará el {DATE_TIME_FORMAT.format(new Date(lottery.startDate))}.</p>;
      case 'FINISHED':
        return <p className="rounded-lg border border-warning/30 bg-warning-bg p-4 text-warning">{FINISHED_MESSAGE}</p>;
      case 'DRAWN':
        return (
          <p className="rounded-lg border border-premium-gold/30 bg-premium-gold/10 p-4 text-premium-gold">
            El sorteo ha terminado.{lottery.winnerName ? ` Ganador: ${lottery.winnerName}.` : ''}
          </p>
        );
      case 'CANCELLED':
        return <p className="text-text-secondary">Este sorteo ha sido cancelado.</p>;
      default:
        return null;
    }
  };

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-dark-bg px-4 py-12 text-text-primary">
        <div className="mx-auto max-w-3xl space-y-8">
          <Link href="/sorteos" className="text-sm text-premium-gold underline-offset-4 hover:underline">
            Volver a sorteos
          </Link>

          <header className="space-y-3">
            <span className="text-xs font-medium uppercase tracking-wide text-premium-gold">
              {LOTTERY_STATUS_LABELS[lottery.status]}
            </span>
            <h1 className="text-3xl font-bold">{lottery.title}</h1>
            <p className="text-text-secondary">Premio: {lottery.prize}</p>
            {lottery.prizeImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lottery.prizeImageUrl} alt={`Premio: ${lottery.prize}`} className="max-h-80 rounded-xl object-contain" />
            )}
            <p className="whitespace-pre-line text-text-secondary">{lottery.description}</p>
            <p className="text-sm text-text-muted">
              Del {DATE_FORMAT.format(new Date(lottery.startDate))} al {DATE_FORMAT.format(new Date(lottery.endDate))} (hora de Madrid)
            </p>
            {lottery.minimumOrderAmount !== null && (
              <p className="text-sm text-text-muted">Importe mínimo del pedido: {lottery.minimumOrderAmount.toFixed(2)} EUR</p>
            )}
          </header>

          {renderStatusMessage()}

          {success && (
            <div role="status" aria-live="polite" className="rounded-lg border border-success/30 bg-success-bg p-4 text-success">
              {SUCCESS_MESSAGE}
            </div>
          )}

          {formOpen && (
            <section aria-labelledby="participate-heading" className="rounded-xl border border-dark-border bg-dark-surface p-6">
              <h2 id="participate-heading" className="text-xl font-semibold">Participar</h2>

              {!isLoggedIn ? (
                <div className="mt-4 space-y-4">
                  <p className="text-text-secondary">Inicia sesión para participar en este sorteo.</p>
                  <button type="button" onClick={() => setShowLogin(true)} className="btn btn-primary">
                    Iniciar sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} className="mt-4 space-y-5" noValidate>
                  {error && (
                    <div role="alert" className="rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="order-number" className="text-sm font-medium text-text-secondary">
                      Número de pedido
                    </label>
                    <input
                      id="order-number"
                      className={FIELD_CLASS}
                      value={orderNumber}
                      onChange={(event) => setOrderNumber(event.target.value)}
                      required
                      disabled={submitting}
                      autoComplete="off"
                    />
                  </div>

                  <fieldset>
                    <legend className="text-sm font-medium text-text-secondary">¿Dónde realizaste la compra?</legend>
                    <div className="mt-2 flex gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="platform"
                          value="TIKTOK"
                          checked={platform === 'TIKTOK'}
                          onChange={() => setPlatform('TIKTOK')}
                          disabled={submitting}
                        />
                        TikTok
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="platform"
                          value="WEBSITE"
                          checked={platform === 'WEBSITE'}
                          onChange={() => setPlatform('WEBSITE')}
                          disabled={submitting}
                        />
                        Web
                      </label>
                    </div>
                  </fieldset>

                  {platform === 'TIKTOK' && (
                    <div>
                      <label htmlFor="tiktok-username" className="text-sm font-medium text-text-secondary">
                        Usuario de TikTok
                      </label>
                      <input
                        id="tiktok-username"
                        className={FIELD_CLASS}
                        value={tiktokUsername}
                        onChange={(event) => setTiktokUsername(event.target.value)}
                        placeholder="@usuario"
                        required
                        disabled={submitting}
                        autoComplete="off"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="order-date" className="text-sm font-medium text-text-secondary">
                      Fecha del pedido
                    </label>
                    <input
                      id="order-date"
                      type="date"
                      className={FIELD_CLASS}
                      value={orderDate}
                      min={minDate}
                      max={maxDate}
                      onChange={(event) => setOrderDate(event.target.value)}
                      required
                      disabled={submitting}
                    />
                  </div>

                  <button type="submit" disabled={submitting} className="btn btn-primary disabled:opacity-60">
                    {submitting ? 'Enviando...' : 'Enviar participación'}
                  </button>
                </form>
              )}
            </section>
          )}
        </div>
      </main>
      <Footer />
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
