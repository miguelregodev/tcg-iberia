export interface PartyConfiguration {
  boxPriceCents: number;
  packsPerBox: number;
  participantCount: number;
}

export type PartyMode = 'SHARED' | 'BATTLE';

export const PARTY_MODE_INFO: Record<PartyMode, { label: string; summary: string }> = {
  SHARED: {
    label: 'Compartida',
    summary: 'Los sobres que compra cada participante son para él o ella.',
  },
  BATTLE: {
    label: 'Batalla',
    summary: 'El participante con el mejor hit se lleva todos los sobres de la apertura.',
  },
};

export function isPartyMode(value: unknown): value is PartyMode {
  return value === 'SHARED' || value === 'BATTLE';
}

/** Whether a paid participation receives packs once the Party is completed. */
export function ownsPartyPrize(
  mode: PartyMode,
  winnerParticipationId: string | null,
  participationId: string,
): boolean {
  return mode === 'SHARED' || winnerParticipationId === participationId;
}

export function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [euros, cents = ''] = normalized.split('.');
  const amount = Number(euros) * 100 + Number(cents.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function getPartyPricing(configuration: PartyConfiguration) {
  const { boxPriceCents, packsPerBox, participantCount } = configuration;
  if (
    !Number.isSafeInteger(boxPriceCents) ||
    boxPriceCents <= 0 ||
    !Number.isInteger(packsPerBox) ||
    !Number.isInteger(participantCount) ||
    participantCount < 2 ||
    participantCount >= packsPerBox ||
    packsPerBox % participantCount !== 0
  ) {
    return null;
  }

  const participationPriceCents = Math.round(boxPriceCents / participantCount);
  const totalRevenueCents = participationPriceCents * participantCount;

  return {
    boxPriceCents,
    participationPriceCents,
    packsPerParticipant: packsPerBox / participantCount,
    totalRevenueCents,
    revenueDifferenceCents: totalRevenueCents - boxPriceCents,
  };
}

export function isValidPartyPaymentConfirmation(
  expectedCents: number,
  actualCents: number,
  currency?: string,
): boolean {
  return (
    Number.isSafeInteger(expectedCents) &&
    expectedCents > 0 &&
    Number.isSafeInteger(actualCents) &&
    actualCents === expectedCents &&
    (currency === undefined || currency === '978')
  );
}

export function isValidTikTokLiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'www.tiktok.com' || url.hostname === 'tiktok.com') &&
      /^\/@[\w.-]+\/live\/?$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}

export interface StartPartyParticipation {
  status: string;
  refundStatus: string;
  paidAt: Date | null;
  orderId: string | null;
}

export function getStartPartyError(
  participantCount: number,
  participants: StartPartyParticipation[],
): string | null {
  if (participants.length !== participantCount) {
    return 'Todas las plazas deben tener una participación confirmada.';
  }
  if (
    participants.some(
      (participation) =>
        participation.status !== 'PAID' ||
        participation.refundStatus === 'REQUESTED' ||
        participation.refundStatus === 'APPROVED' ||
        !participation.paidAt ||
        !participation.orderId,
    )
  ) {
    return 'Hay participaciones pendientes, inválidas o con una solicitud de reembolso sin resolver.';
  }
  return null;
}
