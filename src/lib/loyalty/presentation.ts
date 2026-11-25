export interface TierTrackItem {
  name: string;
  threshold: string;
  color: string;
  multiplier: string;
}

export function serializeTierTrack(
  tiers: readonly { name: string; threshold: { toString(): string }; color: string; multiplier: { toString(): string } }[],
): TierTrackItem[] {
  return tiers.map((tier) => ({
    name: tier.name,
    threshold: tier.threshold.toString(),
    color: tier.color,
    multiplier: tier.multiplier.toString(),
  }));
}

const pointsFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const multiplierFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 });

export function formatTierMultiplier(value: string): string {
  return `x${multiplierFormatter.format(Number(value))}`;
}

export function formatLoyaltyPoints(value: string): string {
  return pointsFormatter.format(Math.floor(Number(value)));
}
