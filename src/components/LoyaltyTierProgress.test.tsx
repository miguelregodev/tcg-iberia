import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoyaltyTierProgress } from './LoyaltyTierProgress';

const tiers = [
  { name: 'Principiante', threshold: '0', color: '#9CA3AF', multiplier: '1' },
  { name: 'Avanzado', threshold: '500', color: '#60A5FA', multiplier: '1.25' },
  { name: 'Experto', threshold: '1000', color: '#C084FC', multiplier: '1.5' },
  { name: 'God', threshold: '2000', color: '#D4AF37', multiplier: '1.75' },
];

describe('LoyaltyTierProgress', () => {
  it('shows the configured points multiplier above every tier, including unreached ones', () => {
    const html = renderToStaticMarkup(<LoyaltyTierProgress tiers={tiers} currentTier="Principiante" progress={0} />);
    for (const label of ['x1 ', 'x1,25 ', 'x1,5 ', 'x1,75 ']) expect(html).toContain(label);
  });

  it('shows all configured tiers and fills only the reached sections and current progress', () => {
    const html = renderToStaticMarkup(<LoyaltyTierProgress tiers={tiers} currentTier="Avanzado" progress={25} />);
    for (const tier of tiers) expect(html).toContain(tier.name);
    expect(html).toContain('aria-label="Progreso hacia Experto"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html.match(/width:100%/g)).toHaveLength(1);
    expect(html.match(/width:25%/g)).toHaveLength(1);
    expect(html.match(/width:0%/g)).toHaveLength(2);
  });

  it('shows a completed track at the highest tier', () => {
    const html = renderToStaticMarkup(<LoyaltyTierProgress tiers={tiers} currentTier="God" progress={100} />);
    expect(html).toContain('aria-label="Nivel máximo alcanzado"');
    expect(html.match(/width:100%/g)).toHaveLength(4);
  });
});
