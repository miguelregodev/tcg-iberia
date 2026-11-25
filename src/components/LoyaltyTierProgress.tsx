import React from 'react';
import { formatTierMultiplier, type TierTrackItem } from '@/lib/loyalty/presentation';

interface LoyaltyTierProgressProps {
  tiers: TierTrackItem[];
  currentTier: string;
  progress: number;
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function LoyaltyTierProgress({ tiers, currentTier, progress }: LoyaltyTierProgressProps) {
  const currentIndex = tiers.findIndex((tier) => tier.name === currentTier);
  const nextTier = tiers[currentIndex + 1];
  const percentage = Math.max(0, Math.min(100, progress));

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-dark-bg p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">Tus recompensas</p>
        <span className="whitespace-nowrap rounded-full border border-premium-gold/30 bg-premium-gold/10 px-2.5 py-1 text-xs font-semibold text-premium-gold">
          {nextTier ? `${Math.floor(percentage)} % del tramo` : 'Nivel máximo'}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={nextTier ? `Progreso hacia ${nextTier.name}` : 'Nivel máximo alcanzado'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={nextTier ? `${percentage} % hacia ${nextTier.name}` : 'Nivel máximo alcanzado'}
        className="sr-only"
      />
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex gap-1.5 sm:gap-2">
          {tiers.map((tier, index) => {
            const fill = index < currentIndex || (index === currentIndex && !nextTier)
              ? 100 : index === currentIndex ? percentage : 0;
            const color = /^#[0-9a-f]{6}$/i.test(tier.color) ? tier.color : '#F5E77A';
            return (
              <div key={tier.name} className="min-w-[2.75rem] flex-1">
                <p
                  className="mb-2 text-[11px] font-bold leading-tight sm:text-xs"
                  style={{ color }}
                >
                  {formatTierMultiplier(tier.multiplier)} <span className="font-medium text-text-secondary">puntos</span>
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${fill}%`, backgroundColor: color }} />
                </div>
                <p className={`mt-3 break-words text-[11px] font-semibold leading-tight sm:text-xs ${index === currentIndex ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {tier.name}
                </p>
                <p className="mt-1 text-[11px] leading-tight text-text-secondary">{currencyFormatter.format(Number(tier.threshold))}</p>
                {index === currentIndex && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-premium-gold">Actual</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
