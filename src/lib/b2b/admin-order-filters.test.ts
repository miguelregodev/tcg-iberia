import { describe, expect, it } from 'vitest';
import { buildAdminOrderOrderBy, buildAdminOrderWhere, parseAdminOrderFilters } from './admin-order-filters';

const parse = (qs: string) => parseAdminOrderFilters(new URLSearchParams(qs));

describe('admin B2B order filters', () => {
  it('combines every filter with AND and validates enums', () => {
    const f = parse(
      'email=shop@x.com&orderNumber=PED-2026&vat=B123&company=Cards&paymentStatus=PAID&fulfillmentStatus=SHIPPED&status=ACCEPTED&source=ADMIN&invoice=issued&from=2026-01-01&to=2026-01-31'
    );
    const where = buildAdminOrderWhere(f);
    const and = (where.AND ?? []) as object[];
    expect(and).toEqual(
      expect.arrayContaining([
        { customer: { is: { email: { contains: 'shop@x.com', mode: 'insensitive' } } } },
        { orderNumber: { contains: 'PED-2026', mode: 'insensitive' } },
        { customer: { is: { vatNumber: { contains: 'B123', mode: 'insensitive' } } } },
        { paymentStatus: 'PAID' },
        { fulfillmentStatus: 'SHIPPED' },
        { status: 'ACCEPTED' },
        { source: 'ADMIN' },
        { documents: { some: { type: 'INVOICE', status: 'ISSUED' } } },
        {
          createdAt: {
            gte: new Date('2026-01-01T00:00:00.000Z'),
            lte: new Date('2026-01-31T23:59:59.999Z'),
          },
        },
      ])
    );
  });

  it('ignores invalid values and clamps pagination', () => {
    const f = parse('paymentStatus=HACKED&invoice=maybe&from=yesterday&page=-4&pageSize=5000&sort=password');
    expect(f.paymentStatus).toBeNull();
    expect(f.invoice).toBeNull();
    expect(f.from).toBeNull();
    expect(f.page).toBe(1);
    expect(f.pageSize).toBe(100);
    expect(f.sort).toBe('createdAt');
    expect(buildAdminOrderWhere(f)).toEqual({});
  });

  it('supports "no invoice" and sorting by amount', () => {
    const f = parse('invoice=none&sort=total&dir=asc');
    expect(buildAdminOrderWhere(f)).toEqual({ AND: [{ documents: { none: { type: 'INVOICE' } } }] });
    expect(buildAdminOrderOrderBy(f)).toEqual([{ total: 'asc' }, { createdAt: 'desc' }]);
  });
});
