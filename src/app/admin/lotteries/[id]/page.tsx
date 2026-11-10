'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import {
  LOTTERY_STATUS_LABELS,
  REJECTION_REASON_LABELS,
  REJECTION_REASONS,
  getLotteryEditMode,
  type LotteryRejectionReason,
  type LotteryStatus,
} from '@/lib/lottery/core';
import LotteryForm, { FIELD_CLASS, toMadridInputValue, type LotteryFormValues } from '../LotteryForm';

interface AdminLottery {
  id: string;
  title: string;
  slug: string;
  prize: string;
  prizeImageUrl: string | null;
  description: string;
  startDate: string;
  endDate: string;
  minimumOrderAmount: string | number | null;
  status: LotteryStatus;
  eligibleCountAtDraw: number | null;
  drawnAt: string | null;
  winnerParticipation: {
    id: string;
    orderNumber: string;
    userEmailSnapshot: string;
    user: { fullName: string | null };
  } | null;
  auditLogs: { id: string; action: string; adminId: string | null; createdAt: string; details: unknown }[];
}

interface Participation {
  id: string;
  orderNumber: string;
  platform: 'TIKTOK' | 'WEBSITE';
  tiktokUsername: string | null;
  orderDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: LotteryRejectionReason | null;
  rejectionReasonDetails: string | null;
  submittedAt: string;
  user: { fullName: string | null; email: string };
}

type ReviewAction = { participation: Participation; decision: 'APPROVE' | 'REJECT' } | null;

const LOTTERY_ACTION_LABELS: Record<string, string> = {
  publish: 'Publicar',
  start: 'Iniciar ahora',
  finish: 'Finalizar ahora',
  cancel: 'Cancelar sorteo',
};

const PARTICIPATION_STATUS_LABELS: Record<Participation['status'], string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

const PLATFORM_LABELS: Record<Participation['platform'], string> = {
  TIKTOK: 'TikTok',
  WEBSITE: 'Web',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'medium' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Actions allowed per status; the server enforces the same rules. */
function availableActions(status: LotteryStatus): string[] {
  switch (status) {
    case 'DRAFT':
      return ['publish', 'cancel'];
    case 'SCHEDULED':
      return ['start', 'finish', 'cancel'];
    case 'ACTIVE':
      return ['finish', 'cancel'];
    default:
      return [];
  }
}

export default function AdminLotteryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lotteryId = params.id;

  const [lottery, setLottery] = useState<AdminLottery | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ReviewAction>(null);
  const [reason, setReason] = useState<LotteryRejectionReason>('INVALID_ORDER_DATE');
  const [reasonDetails, setReasonDetails] = useState('');
  const [drawOpen, setDrawOpen] = useState(false);

  const loadLottery = useCallback(async () => {
    const response = await fetch(`/api/admin/lotteries/${lotteryId}`);
    const result = (await response.json()) as { lottery?: AdminLottery; error?: string };
    if (!response.ok || !result.lottery) throw new Error(result.error || 'No se pudo cargar el sorteo.');
    setLottery(result.lottery);
  }, [lotteryId]);

  const loadParticipations = useCallback(async () => {
    const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
    const response = await fetch(`/api/admin/lotteries/${lotteryId}/participations${query}`);
    const result = (await response.json()) as { participations?: Participation[]; error?: string };
    if (!response.ok || !result.participations) throw new Error(result.error || 'No se pudieron cargar las participaciones.');
    setParticipations(result.participations);
  }, [lotteryId, statusFilter]);

  useEffect(() => {
    Promise.all([loadLottery(), loadParticipations()])
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Error al cargar el sorteo.'))
      .finally(() => setLoading(false));
  }, [loadLottery, loadParticipations]);

  const runRequest = async (url: string, init: RequestInit, successMessage: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, init);
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'La operación no se pudo completar.');
      setNotice(successMessage);
      await Promise.all([loadLottery(), loadParticipations()]);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'La operación no se pudo completar.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runAction = (action: string) =>
    runRequest(
      `/api/admin/lotteries/${lotteryId}/action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      },
      'Estado del sorteo actualizado.',
    );

  const submitReview = async () => {
    if (!review) return;
    const ok = await runRequest(
      `/api/admin/lotteries/${lotteryId}/participations/${review.participation.id}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: review.decision,
          reason: review.decision === 'REJECT' ? reason : undefined,
          details: review.decision === 'REJECT' ? reasonDetails : undefined,
        }),
      },
      review.decision === 'APPROVE' ? 'Participación aprobada.' : 'Participación rechazada.',
    );
    if (ok) {
      setReview(null);
      setReasonDetails('');
    }
  };

  const drawWinner = async () => {
    const ok = await runRequest(`/api/admin/lotteries/${lotteryId}/draw`, { method: 'POST' }, 'Ganador elegido.');
    if (ok) setDrawOpen(false);
  };

  const deleteLottery = async () => {
    if (!window.confirm('¿Eliminar este sorteo? Esta acción no se puede deshacer.')) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/lotteries/${lotteryId}`, { method: 'DELETE' });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo eliminar el sorteo.');
      router.push('/admin/lotteries');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el sorteo.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg text-text-primary">
        <AdminNav />
        <main className="mx-auto max-w-6xl px-4 py-8 text-text-muted">Cargando sorteo...</main>
      </div>
    );
  }

  if (!lottery) {
    return (
      <div className="min-h-screen bg-dark-bg text-text-primary">
        <AdminNav />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <p role="alert" className="text-red-300">{error ?? 'Sorteo no encontrado.'}</p>
          <Link href="/admin/lotteries" className="text-premium-gold underline-offset-4 hover:underline">
            Volver a sorteos
          </Link>
        </main>
      </div>
    );
  }

  const mode = getLotteryEditMode(lottery.status);
  const formValues: LotteryFormValues = {
    title: lottery.title,
    prize: lottery.prize,
    description: lottery.description,
    prizeImageUrl: lottery.prizeImageUrl ?? '',
    startDate: toMadridInputValue(lottery.startDate),
    endDate: toMadridInputValue(lottery.endDate),
    minimumOrderAmount: lottery.minimumOrderAmount === null ? '' : String(lottery.minimumOrderAmount),
  };
  const canReview = lottery.status !== 'DRAWN' && lottery.status !== 'CANCELLED' && lottery.status !== 'DRAFT';
  const canDraw = lottery.status === 'FINISHED' && !lottery.winnerParticipation;
  const canDelete =
    (lottery.status === 'DRAFT' || lottery.status === 'CANCELLED') && participations.length === 0;

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary">
      <AdminNav />
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <div>
          <Link href="/admin/lotteries" className="text-sm text-premium-gold underline-offset-4 hover:underline">
            Volver a sorteos
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{lottery.title}</h1>
            <span className="rounded-full border border-dark-borderStrong px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {LOTTERY_STATUS_LABELS[lottery.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Página pública:{' '}
            <Link href={`/sorteos/${lottery.slug}`} className="text-premium-gold underline-offset-4 hover:underline">
              /sorteos/{lottery.slug}
            </Link>
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" aria-live="polite" className="rounded-lg border border-success/30 bg-success-bg p-3 text-sm text-success">
            {notice}
          </div>
        )}

        <section aria-labelledby="lottery-actions-heading" className="space-y-3">
          <h2 id="lottery-actions-heading" className="text-lg font-semibold">Acciones</h2>
          <div className="flex flex-wrap gap-3">
            {availableActions(lottery.status).map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => void runAction(action)}
                className={action === 'cancel' ? 'btn btn-secondary disabled:opacity-60' : 'btn btn-primary disabled:opacity-60'}
              >
                {LOTTERY_ACTION_LABELS[action]}
              </button>
            ))}
            {canDraw && (
              <button type="button" disabled={busy} onClick={() => setDrawOpen(true)} className="btn btn-primary disabled:opacity-60">
                Elegir ganador
              </button>
            )}
            {canDelete && (
              <button type="button" disabled={busy} onClick={() => void deleteLottery()} className="btn btn-secondary disabled:opacity-60">
                Eliminar sorteo
              </button>
            )}
          </div>
          {lottery.winnerParticipation && (
            <div className="rounded-lg border border-premium-gold/30 bg-premium-gold/10 p-4 text-sm">
              <p className="font-semibold text-premium-gold">Ganador</p>
              <p>
                {lottery.winnerParticipation.user.fullName ?? 'Sin nombre'} ({lottery.winnerParticipation.userEmailSnapshot}) · Pedido{' '}
                {lottery.winnerParticipation.orderNumber}
              </p>
              {lottery.drawnAt && <p className="text-text-muted">Elegido el {DATE_TIME_FORMAT.format(new Date(lottery.drawnAt))}</p>}
            </div>
          )}
        </section>

        <section aria-labelledby="lottery-edit-heading" className="space-y-4">
          <h2 id="lottery-edit-heading" className="text-lg font-semibold">Datos del sorteo</h2>
          {mode === 'locked' && (
            <p className="text-sm text-text-muted">Este sorteo está bloqueado y no se puede editar en su estado actual.</p>
          )}
          {mode === 'active' && (
            <p className="text-sm text-text-muted">El sorteo está activo: solo se pueden cambiar los textos y la fecha de fin.</p>
          )}
          <LotteryForm
            key={lottery.id + lottery.status + lottery.endDate}
            lotteryId={lottery.id}
            initialValues={formValues}
            startLocked={mode === 'active'}
            readOnly={mode === 'locked'}
          />
        </section>

        <section aria-labelledby="participations-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="participations-heading" className="text-lg font-semibold">Participaciones</h2>
            <div>
              <label htmlFor="status-filter" className="text-sm text-text-secondary">
                Estado
              </label>
              <select
                id="status-filter"
                className={`${FIELD_CLASS} mt-0 w-auto`}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">Todas</option>
                <option value="PENDING">Pendientes</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="REJECTED">Rechazadas</option>
              </select>
            </div>
          </div>

          {participations.length === 0 ? (
            <p className="text-text-muted">No hay participaciones para este filtro.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-dark-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-dark-surface text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 font-medium">Pedido</th>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                    <th className="px-4 py-3 font-medium">Plataforma</th>
                    <th className="px-4 py-3 font-medium">Fecha del pedido</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {participations.map((participation) => (
                    <tr key={participation.id} className="bg-dark-bg align-top">
                      <td className="px-4 py-3 font-mono">{participation.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div>{participation.user.fullName ?? 'Sin nombre'}</div>
                        <div className="text-text-muted">{participation.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {PLATFORM_LABELS[participation.platform]}
                        {participation.tiktokUsername && (
                          <div className="text-text-muted">@{participation.tiktokUsername}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{DATE_FORMAT.format(new Date(participation.orderDate))}</td>
                      <td className="px-4 py-3">
                        {PARTICIPATION_STATUS_LABELS[participation.status]}
                        {participation.status === 'REJECTED' && participation.rejectionReason && (
                          <div className="text-text-muted">
                            {REJECTION_REASON_LABELS[participation.rejectionReason]}
                            {participation.rejectionReasonDetails ? `: ${participation.rejectionReasonDetails}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canReview && (
                          <div className="flex flex-wrap gap-2">
                            {participation.status !== 'APPROVED' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setReview({ participation, decision: 'APPROVE' })}
                                className="btn btn-primary disabled:opacity-60"
                              >
                                Aprobar<span className="sr-only"> pedido {participation.orderNumber}</span>
                              </button>
                            )}
                            {participation.status !== 'REJECTED' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setReason('INVALID_ORDER_DATE');
                                  setReasonDetails('');
                                  setReview({ participation, decision: 'REJECT' });
                                }}
                                className="btn btn-secondary disabled:opacity-60"
                              >
                                Rechazar<span className="sr-only"> pedido {participation.orderNumber}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {review && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="review-dialog-title"
              className="w-full max-w-md rounded-xl border border-dark-border bg-dark-surface p-6"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !busy) setReview(null);
              }}
            >
              <h3 id="review-dialog-title" className="text-lg font-semibold">
                {review.decision === 'APPROVE' ? 'Aprobar participación' : 'Rechazar participación'}
              </h3>
              <p className="mt-1 text-sm text-text-muted">Pedido {review.participation.orderNumber}</p>

              {review.decision === 'REJECT' && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="reject-reason" className="text-sm font-medium text-text-secondary">
                      Motivo
                    </label>
                    <select
                      id="reject-reason"
                      className={FIELD_CLASS}
                      value={reason}
                      onChange={(event) => setReason(event.target.value as LotteryRejectionReason)}
                    >
                      {REJECTION_REASONS.map((value) => (
                        <option key={value} value={value}>
                          {REJECTION_REASON_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {reason === 'OTHER' && (
                    <div>
                      <label htmlFor="reject-details" className="text-sm font-medium text-text-secondary">
                        Detalle (obligatorio)
                      </label>
                      <textarea
                        id="reject-details"
                        className={FIELD_CLASS}
                        rows={3}
                        maxLength={500}
                        value={reasonDetails}
                        onChange={(event) => setReasonDetails(event.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" disabled={busy} onClick={() => setReview(null)} className="btn btn-secondary disabled:opacity-60">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || (review.decision === 'REJECT' && reason === 'OTHER' && !reasonDetails.trim())}
                  onClick={() => void submitReview()}
                  className="btn btn-primary disabled:opacity-60"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {drawOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="draw-dialog-title"
              className="w-full max-w-md rounded-xl border border-dark-border bg-dark-surface p-6"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !busy) setDrawOpen(false);
              }}
            >
              <h3 id="draw-dialog-title" className="text-lg font-semibold">Elegir ganador</h3>
              <p className="mt-2 text-sm text-text-secondary">
                Se elegirá un ganador al azar entre las participaciones aprobadas. Esta acción es definitiva.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" disabled={busy} onClick={() => setDrawOpen(false)} className="btn btn-secondary disabled:opacity-60">
                  Cancelar
                </button>
                <button type="button" disabled={busy} onClick={() => void drawWinner()} className="btn btn-primary disabled:opacity-60">
                  Elegir ganador
                </button>
              </div>
            </div>
          </div>
        )}

        <section aria-labelledby="audit-heading" className="space-y-3">
          <h2 id="audit-heading" className="text-lg font-semibold">Historial</h2>
          {lottery.auditLogs.length === 0 ? (
            <p className="text-text-muted">Sin movimientos.</p>
          ) : (
            <ul className="space-y-2 text-sm text-text-secondary">
              {lottery.auditLogs.map((log) => (
                <li key={log.id}>
                  <span className="text-text-muted">{DATE_TIME_FORMAT.format(new Date(log.createdAt))}</span> · {log.action}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
