import { describe, expect, it } from 'vitest';
import {
  getPartyPricing,
  getStartPartyError,
  isValidPartyPaymentConfirmation,
  isValidTikTokLiveUrl,
  ownsPartyPrize,
  parseMoneyToCents,
} from './core';

describe('Party mode prize ownership', () => {
  it('gives every participant their packs in a Compartida party', () => {
    expect(ownsPartyPrize('SHARED', null, 'p1')).toBe(true);
    expect(ownsPartyPrize('SHARED', 'p2', 'p1')).toBe(true);
  });

  it('gives all packs only to the winner in a Batalla party', () => {
    expect(ownsPartyPrize('BATTLE', 'p1', 'p1')).toBe(true);
    expect(ownsPartyPrize('BATTLE', 'p2', 'p1')).toBe(false);
    expect(ownsPartyPrize('BATTLE', null, 'p1')).toBe(false);
  });
});

describe('Party configuration', () => {
  it('splits a 30-pack box across exact valid participant counts', () => {
    for (const participantCount of [2, 3, 5, 6, 10, 15]) {
      expect(
        getPartyPricing({ boxPriceCents: 3000, packsPerBox: 30, participantCount }),
      ).toMatchObject({
        participationPriceCents: 3000 / participantCount,
        packsPerParticipant: 30 / participantCount,
        totalRevenueCents: 3000,
      });
    }
    expect(
      getPartyPricing({ boxPriceCents: 6995, packsPerBox: 30, participantCount: 5 }),
    ).toMatchObject({ participationPriceCents: 1399, totalRevenueCents: 6995 });
  });

  it('rejects invalid pack splits and rounds each participation to the nearest cent', () => {
    expect(getPartyPricing({ boxPriceCents: 6995, packsPerBox: 30, participantCount: 4 })).toBeNull();
    expect(getPartyPricing({ boxPriceCents: 6995, packsPerBox: 30, participantCount: 1 })).toBeNull();
    expect(getPartyPricing({ boxPriceCents: 100, packsPerBox: 30, participantCount: 3 })).toMatchObject({
      participationPriceCents: 33,
      totalRevenueCents: 99,
      revenueDifferenceCents: -1,
    });
    expect(getPartyPricing({ boxPriceCents: 100, packsPerBox: 30, participantCount: 6 })).toMatchObject({
      participationPriceCents: 17,
      totalRevenueCents: 102,
      revenueDifferenceCents: 2,
    });
    expect(parseMoneyToCents('69.959')).toBeNull();
    expect(parseMoneyToCents('69,95')).toBe(6995);
  });

  it('accepts only HTTPS TikTok profile LIVE URLs', () => {
    expect(isValidTikTokLiveUrl('https://www.tiktok.com/@tcgiberia/live')).toBe(true);
    expect(isValidTikTokLiveUrl('https://tiktok.com/@tcg.iberia/live?lang=es')).toBe(true);
    expect(isValidTikTokLiveUrl('https://evil.example/@tcgiberia/live')).toBe(false);
    expect(isValidTikTokLiveUrl('https://www.tiktok.com/@tcgiberia/video/123')).toBe(false);
    expect(isValidTikTokLiveUrl('javascript:alert(1)')).toBe(false);
  });

  it('accepts signed Redsys payment confirmations with omitted optional currency', () => {
    expect(isValidPartyPaymentConfirmation(3198, 3198)).toBe(true);
    expect(isValidPartyPaymentConfirmation(3198, 3198, '978')).toBe(true);
    expect(isValidPartyPaymentConfirmation(3198, 3197, '978')).toBe(false);
    expect(isValidPartyPaymentConfirmation(3198, 3198, '840')).toBe(false);
  });

  it('blocks start while a refund request is unresolved or a participant is invalid', () => {
    const paid = {
      status: 'PAID',
      refundStatus: 'NONE',
      paidAt: new Date(),
      orderId: 'order-1',
    };
    expect(getStartPartyError(1, [paid])).toBeNull();
    expect(getStartPartyError(1, [{ ...paid, refundStatus: 'REQUESTED' }])).toContain('reembolso');
    expect(getStartPartyError(2, [paid])).toContain('plazas');
  });
});
