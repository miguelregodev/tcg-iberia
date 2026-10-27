'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/AdminNav';
import { getPartyPricing, parseMoneyToCents, PARTY_MODE_INFO, type PartyMode } from '@/lib/parties/core';

interface Product {
  id: string;
  name: string;
  language: string;
  price: string | number;
  liveOpeningPrice?: string | number | null;
  stock: number;
  imageUrl: string | null;
  type: string | null;
}

// Parties are sold as live openings, so that variant's price wins when defined.
function getPartyBoxPrice(product: Pick<Product, 'price' | 'liveOpeningPrice'>) {
  return product.liveOpeningPrice ?? product.price;
}

interface Participant {
  id: string;
  slotNumber: number | null;
  status: string;
  refundStatus: string;
  amountPaid: number;
  paidAt: string | null;
  redsysOrderId: string | null;
  redsysTransactionId: string | null;
  user: { id: string; fullName: string | null; email: string };
  order: { id: string; orderNumber: string; status: string; paymentStatus: string } | null;
}

interface Party {
  id: string;
  productId: string;
  product: { id: string; name: string; slug: string; imageUrl: string | null; language: string };
  boxPrice: number;
  participationPrice: number;
  packsPerBox: number;
  participantCount: number;
  packsPerParticipant: number;
  mode: PartyMode;
  status: string;
  tiktokLiveUrl: string | null;
  createdAt: string;
  participations: Participant[];
  winnerParticipation: { id: string; user: { fullName: string | null; email: string } } | null;
}

const PARTY_STATUS: Record<string, string> = {
  OPEN: 'Abierta',
  FULL: 'Completa',
  IN_PROGRESS: 'Party Iniciada',
  COMPLETED: 'Finalizada',
  CANCELLED: 'Cancelada',
};

const PARTY_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-950/40 text-blue-300 border-blue-800/40',
  FULL: 'bg-premium-gold/15 text-premium-gold border-premium-gold/30',
  IN_PROGRESS: 'bg-warning-bg text-warning border-warning/30',
  COMPLETED: 'bg-success-bg text-success border-success/30',
  CANCELLED: 'bg-dark-surfaceHover text-text-secondary border-dark-borderStrong',
};

const FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-dark-border bg-dark-surface px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-premium-gold';

export default function AdminPartiesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [productId, setProductId] = useState('');
  const [packsPerBox, setPacksPerBox] = useState('30');
  const [participantCount, setParticipantCount] = useState('');
  const [mode, setMode] = useState<PartyMode>('SHARED');
  const [internalNotes, setInternalNotes] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [liveUrl, setLiveUrl] = useState('');
  const [startPartyId, setStartPartyId] = useState<string | null>(null);
  const [finalizePartyId, setFinalizePartyId] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadParties = useCallback(async () => {
    const response = await fetch('/api/admin/parties');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las Parties.');
    setParties(result as Party[]);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/products').then(async (response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los productos.');
        setProducts((await response.json()) as Product[]);
      }),
      loadParties(),
    ])
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Error al cargar el panel.'))
      .finally(() => setLoading(false));
  }, [loadParties]);

  const selectedProduct = products.find((product) => product.id === productId);
  const priceCents = selectedProduct ? parseMoneyToCents(String(getPartyBoxPrice(selectedProduct))) : null;
  const pricing = priceCents && Number.isInteger(Number(packsPerBox)) && Number.isInteger(Number(participantCount))
    ? getPartyPricing({
        boxPriceCents: priceCents,
        packsPerBox: Number(packsPerBox),
        participantCount: Number(participantCount),
      })
    : null;

  const filteredParties = useMemo(
    () =>
      parties.filter((party) => {
        const matchesSearch = `${party.product.name} ${party.id}`.toLowerCase().includes(search.toLowerCase());
        return matchesSearch && (statusFilter === 'ALL' || party.status === statusFilter);
      }),
    [parties, search, statusFilter],
  );

  const createParty = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pricing || !selectedProduct || selectedProduct.stock < 1) {
      setError('Revisa el producto, el stock y que los packs puedan repartirse exactamente.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          packsPerBox: Number(packsPerBox),
          participantCount: Number(participantCount),
          mode,
          internalNotes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo crear la Party.');
      setNotice('Party creada y una unidad de stock reservada.');
      setInternalNotes('');
      setParticipantCount('');
      await Promise.all([loadParties(), fetch('/api/admin/products').then((r) => r.json()).then(setProducts)]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Error al crear la Party.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    partyId: string,
    action: string,
    values: Record<string, string> = {},
  ) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/parties/${partyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la Party.');
      setNotice(
        result.manualRefundRequired
          ? 'Party cancelada. Reembolsa los pagos confirmados desde Redsys y después confirma cada reembolso aquí.'
          : result.pendingPaymentCount
            ? 'Party cancelada. Redsys no permite invalidar aquí un pago ya abierto; cualquier pago tardío quedará pendiente de resolución administrativa.'
            : 'La Party se ha actualizado correctamente.',
      );
      setStartPartyId(null);
      setFinalizePartyId(null);
      setLiveUrl('');
      setWinnerId('');
      await loadParties();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Error al actualizar la Party.');
    } finally {
      setSaving(false);
    }
  };

  const selectedFinalizeParty = parties.find((party) => party.id === finalizePartyId);

  return (
    <div className="min-h-screen bg-dark-bg">
      <AdminNav />
      <main className="container-custom px-4 py-8">
        <h1 className="text-h2">Gestión de Parties</h1>
        <p className="mt-2 text-sm text-text-muted">Las Parties reservan una caja del stock existente; el precio se toma del producto del catálogo.</p>
        {error && <p role="alert" className="mt-5 rounded-lg border border-danger/30 bg-danger-bg p-3 text-danger">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-lg border border-success/30 bg-success-bg p-3 text-success">{notice}</p>}

        <form onSubmit={createParty} className="mt-7 rounded-xl border border-dark-border bg-dark-surface p-5 sm:p-7">
          <h2 className="text-xl font-bold text-text-primary">Crear Party</h2>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="party-product" className="block text-sm font-medium text-text-primary">Producto / variante de idioma</label>
              <select id="party-product" value={productId} onChange={(event) => setProductId(event.target.value)} required className={FIELD_CLASS}>
                <option value="">Selecciona un producto visible</option>
                {products.filter((product) => product.stock > 0 && product.type?.trim().toLowerCase() === 'booster box').map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.language} — {Number(getPartyBoxPrice(product)).toFixed(2)} € — stock {product.stock}
                  </option>
                ))}
              </select>
              {selectedProduct && <p className="mt-1 text-sm text-text-muted">Stock disponible: {selectedProduct.stock}</p>}
            </div>
            <div>
              <label htmlFor="party-packs" className="block text-sm font-medium text-text-primary">Packs por caja</label>
              <input id="party-packs" type="number" min="3" step="1" required value={packsPerBox} onChange={(event) => setPacksPerBox(event.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label htmlFor="party-participants" className="block text-sm font-medium text-text-primary">Número de participantes</label>
              <input id="party-participants" type="number" min="2" step="1" required value={participantCount} onChange={(event) => setParticipantCount(event.target.value)} className={FIELD_CLASS} />
            </div>
            <fieldset className="md:col-span-2">
              <legend className="block text-sm font-medium text-text-primary">Tipo de Party</legend>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(PARTY_MODE_INFO) as PartyMode[]).map((option) => (
                  <label key={option} className={`cursor-pointer rounded-lg border p-3 text-sm ${mode === option ? 'border-premium-gold bg-premium-gold/10' : 'border-dark-border bg-dark-bgSecondary'}`}>
                    <input type="radio" name="party-mode" value={option} checked={mode === option} onChange={() => setMode(option)} className="mr-2" />
                    <strong className="text-text-primary">{PARTY_MODE_INFO[option].label}</strong>
                    <span className="mt-1 block text-text-secondary">
                      {option === 'SHARED'
                        ? 'Los sobres que compra cada participante son para él o ella. No hay ganador.'
                        : 'El participante con el mejor hit se lleva todos los sobres de la apertura.'}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="party-notes" className="block text-sm font-medium text-text-primary">Notas internas (opcional)</label>
              <textarea id="party-notes" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={2} className={FIELD_CLASS} />
            </div>
          </div>
          <div className="mt-5 rounded-lg border border-dark-border bg-dark-bgSecondary p-4 text-sm">
            <h3 className="font-semibold text-text-primary">Resumen de precio</h3>
            {selectedProduct && (
              <p className="mt-2 text-text-secondary">Precio de caja{selectedProduct.liveOpeningPrice != null ? ' (apertura en directo)' : ''}: {Number(getPartyBoxPrice(selectedProduct)).toFixed(2)} €</p>
            )}
            {pricing ? (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-text-secondary">
                <p>Participantes: <strong>{Number(participantCount)}</strong></p>
                <p>Packs por persona: <strong>{pricing.packsPerParticipant}</strong></p>
                <p>Precio por plaza: <strong>{(pricing.participationPriceCents / 100).toFixed(2)} €</strong></p>
                <p>Ingresos totales: <strong>{(pricing.totalRevenueCents / 100).toFixed(2)} €</strong></p>
                {pricing.revenueDifferenceCents !== 0 && (
                  <p className="col-span-full text-text-muted">
                    Diferencia por redondeo: {pricing.revenueDifferenceCents > 0 ? '+' : '−'}
                    {(Math.abs(pricing.revenueDifferenceCents) / 100).toFixed(2)} € respecto al precio de la caja.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-warning">El número de participantes debe ser ≥ 2 y dividir exactamente los packs. El precio por plaza se redondea al céntimo más cercano.</p>
            )}
          </div>
          <button type="submit" disabled={saving || !pricing || !selectedProduct || selectedProduct.stock < 1} className="mt-5 btn btn-primary disabled:opacity-50">
            {saving ? 'Creando…' : 'Crear y reservar una caja'}
          </button>
        </form>

        <section className="mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <h2 className="text-xl font-bold text-text-primary">Parties existentes</h2>
            <div className="flex gap-3">
              <label className="sr-only" htmlFor="party-search">Buscar Party</label>
              <input id="party-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o ID" className={FIELD_CLASS} />
              <label className="sr-only" htmlFor="party-filter">Filtrar por estado</label>
              <select id="party-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={FIELD_CLASS}>
                <option value="ALL">Todos los estados</option>
                {Object.entries(PARTY_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          {loading ? <p className="mt-5 text-text-muted">Cargando Parties…</p> : filteredParties.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dark-border bg-dark-surface p-6 text-text-muted">No hay Parties que coincidan con el filtro.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {filteredParties.map((party) => {
                const paid = party.participations.filter((participation) => participation.status === 'PAID' && participation.paidAt);
                const refundRequests = party.participations.filter((participation) => participation.refundStatus === 'REQUESTED' || participation.status === 'REFUND_REQUIRED');
                const start = startPartyId === party.id;
                const finalize = finalizePartyId === party.id;
                return (
                  <article key={party.id} className="rounded-xl border border-dark-border bg-dark-surface p-5 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-5">
                      {party.product.imageUrl && <img src={party.product.imageUrl} alt="" className="h-28 w-28 rounded-lg bg-dark-bgSecondary object-contain p-2" />}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-text-primary">{party.product.name} — {party.product.language}</h3>
                            <p className="mt-1 text-xs text-text-muted">ID: {party.id} · Creada: {new Date(party.createdAt).toLocaleString('es-ES')}</p>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${PARTY_STATUS_STYLES[party.status] ?? PARTY_STATUS_STYLES.CANCELLED}`}>{PARTY_STATUS[party.status]}</span>
                        </div>
                        <p className="mt-2 text-sm text-text-secondary">
                          <span className="mr-2 rounded-full border border-premium-gold/40 px-2 py-0.5 text-xs font-semibold text-premium-gold">{PARTY_MODE_INFO[party.mode].label}</span>
                          {PARTY_MODE_INFO[party.mode].summary}
                        </p>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-text-secondary">
                          <p>Caja: <strong>{party.boxPrice.toFixed(2)} €</strong></p>
                          <p>Participación: <strong>{party.participationPrice.toFixed(2)} €</strong></p>
                          <p>Packs: <strong>{party.packsPerBox} ({party.packsPerParticipant} por persona)</strong></p>
                          <p>Plazas pagadas: <strong>{paid.length}/{party.participantCount}</strong></p>
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {party.participations.map((participation) => (
                            <div key={participation.id} className={`rounded-lg border p-3 text-sm ${participation.refundStatus === 'REQUESTED' || participation.status === 'REFUND_REQUIRED' ? 'border-warning/40 bg-warning-bg' : 'border-dark-border bg-dark-bgSecondary'}`}>
                              <p className="font-semibold">{participation.slotNumber ? `Plaza ${participation.slotNumber}` : 'Sin plaza'} — {participation.user.fullName || participation.user.email}</p>
                              <p className="text-text-secondary">{participation.status} · Reembolso: {participation.refundStatus} · {participation.amountPaid.toFixed(2)} €</p>
                              {(participation.redsysOrderId || participation.redsysTransactionId) && (
                                <p className="text-text-muted">
                                  Redsys: pedido {participation.redsysOrderId ?? '—'} · referencia {participation.redsysTransactionId ?? 'pendiente'}
                                </p>
                              )}
                              {participation.order && (
                                <Link href="/admin/orders" className="text-premium-gold underline hover:text-premium-gold_dark">
                                  Pedido {participation.order.orderNumber} ({participation.order.status})
                                </Link>
                              )}
                              {participation.refundStatus === 'REQUESTED' || participation.status === 'REFUND_REQUIRED' ? (
                                <div className="mt-2 flex gap-3">
                                  <p className="text-warning">
                                    {participation.status === 'REFUND_REQUIRED'
                                      ? 'Pago recibido; conciliando automáticamente la participación.'
                                      : 'Solicitud de reembolso pendiente de revisión.'}
                                  </p>
                                </div>
                              ) : null}
                              {participation.status === 'PENDING_PAYMENT' && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => window.confirm('¿Quitar a este participante de la Party? Su plaza quedará libre.') && runAction(party.id, 'remove-participant', { participationId: participation.id })}
                                  className="mt-2 rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger-bg disabled:opacity-50"
                                >
                                  Quitar participante
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {party.winnerParticipation && party.mode === 'BATTLE' && (
                          <p className="mt-3 text-sm text-success">
                            Mejor hit (ganador/a): {party.winnerParticipation.user.fullName || party.winnerParticipation.user.email}
                          </p>
                        )}
                        {party.tiktokLiveUrl && (
                          <a href={party.tiktokLiveUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-premium-gold underline">Abrir TikTok LIVE</a>
                        )}
                        <div className="mt-5 flex flex-wrap gap-2">
                          {party.status === 'OPEN' && (
                            <button disabled={saving} onClick={() => window.confirm('¿Cancelar la Party y liberar la caja reservada?') && runAction(party.id, 'cancel')} className="rounded-lg border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger-bg disabled:opacity-50">Cancelar Party</button>
                          )}
                          {party.status === 'FULL' && (
                            <button disabled={saving} onClick={() => { setStartPartyId(start ? null : party.id); setLiveUrl(party.tiktokLiveUrl ?? ''); }} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                              {start ? 'Cerrar inicio' : 'Iniciar Party'}
                            </button>
                          )}
                          {party.status === 'IN_PROGRESS' && (
                            <button disabled={saving} onClick={() => { setFinalizePartyId(finalize ? null : party.id); setWinnerId(''); }} className="rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                              {finalize ? 'Cerrar finalización' : party.mode === 'BATTLE' ? 'Finalizar y elegir ganador' : 'Finalizar Party'}
                            </button>
                          )}
                        </div>
                        {start && (
                          <form onSubmit={(event) => { event.preventDefault(); void runAction(party.id, 'start', { tiktokLiveUrl: liveUrl }); }} className="mt-4 rounded-lg border border-blue-800/40 bg-blue-950/20 p-4">
                            <label htmlFor={`live-${party.id}`} className="block text-sm font-semibold text-text-primary">URL de TikTok LIVE</label>
                            <input id={`live-${party.id}`} type="url" required value={liveUrl} onChange={(event) => setLiveUrl(event.target.value)} placeholder="https://www.tiktok.com/@usuario/live" className={FIELD_CLASS} />
                            <p className="mt-2 text-sm text-text-secondary">Solo se admiten enlaces HTTPS de perfiles TikTok LIVE; se comprobarán de nuevo en el servidor junto con todos los pagos y reembolsos.</p>
                            <button disabled={saving} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">Confirmar inicio</button>
                          </form>
                        )}
                        {finalize && selectedFinalizeParty && (
                          <div className="mt-4 rounded-lg border border-success/30 bg-success-bg p-4">
                            <p className="font-semibold text-text-primary">Resumen antes de finalizar</p>
                            <p className="mt-1 text-sm text-text-secondary">
                              {party.mode === 'BATTLE'
                                ? <>{party.product.name} — {party.product.language}; {paid.length} participaciones pagadas. Quien tenga el mejor hit gana todos los sobres: se marcarán como entregadas las órdenes Party no ganadoras ({paid.filter((participant) => participant.id !== winnerId && participant.order).map((participant) => participant.order?.orderNumber).join(', ') || 'selecciona un ganador'}). La orden ganadora seguirá en proceso para solicitar el envío.</>
                                : <>{party.product.name} — {party.product.language}; {paid.length} participaciones pagadas. Party Compartida: no hay ganador. Todas las órdenes seguirán en proceso y cada participante podrá solicitar el envío de sus propios sobres.</>}
                            </p>
                            {party.mode === 'BATTLE' && (
                              <>
                                <label htmlFor={`winner-${party.id}`} className="mt-4 block text-sm font-semibold text-text-primary">Participante con el mejor hit (ganador)</label>
                                <select id={`winner-${party.id}`} value={winnerId} onChange={(event) => setWinnerId(event.target.value)} className={FIELD_CLASS}>
                                  <option value="">Selecciona entre pagos confirmados</option>
                                  {paid.map((participant) => <option key={participant.id} value={participant.id}>{participant.user.fullName || participant.user.email} — plaza {participant.slotNumber}</option>)}
                                </select>
                              </>
                            )}
                            <button
                              disabled={saving || (party.mode === 'BATTLE' && !winnerId)}
                              onClick={() => window.confirm(party.mode === 'BATTLE' ? '¿Confirmas el ganador y que las órdenes Party no ganadoras queden entregadas?' : '¿Finalizar la Party? Cada participante conservará sus sobres.') && runAction(party.id, 'finalize', party.mode === 'BATTLE' ? { winnerParticipationId: winnerId } : {})}
                              className="mt-3 rounded-lg bg-success px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {party.mode === 'BATTLE' ? 'Confirmar ganador y finalizar' : 'Finalizar Party'}
                            </button>
                          </div>
                        )}
                        {refundRequests.length > 0 && (
                          <p className="mt-4 text-sm font-semibold text-warning" role="alert">
                            El inicio está bloqueado hasta resolver {refundRequests.length} solicitud(es) o incidencia(s) de pago.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
