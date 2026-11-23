import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const db = {
    b2bOrder: { findUnique: vi.fn() },
    b2bDocument: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    b2bOrderEvent: { create: vi.fn() },
    sequence: { update: vi.fn(), upsert: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    db,
    put: vi.fn(),
    head: vi.fn(),
    get: vi.fn(),
    sendDocEmail: vi.fn(),
    captureException: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/lib/b2b/document-storage', () => ({
  putB2bDocumentObject: mocks.put,
  headB2bDocumentObject: mocks.head,
  getB2bDocumentObject: mocks.get,
}));
vi.mock('@/lib/b2b/emails', () => ({ sendB2bDocumentEmail: mocks.sendDocEmail }));

import {
  buildDocumentFileName,
  buildDocumentPayload,
  buildDocumentStorageKey,
  describeGenerationError,
  issueB2bDocument,
  retryB2bDocument,
  sanitizeTaxId,
} from './documents';
import { generateB2bDocumentPdf } from './invoice-pdf';

const customer = {
  id: 'cust-1',
  companyName: 'Cartas Norte SL',
  vatNumber: 'B-12.345.678',
  contactName: 'Ana',
  email: 'ana@cartas.test',
  phone: '600000000',
  billingAddress: 'Calle Factura 1\n28001 Madrid',
  shippingAddress: 'Calle Envío 2\n28002 Madrid',
  status: 'ACTIVE',
};

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    customerId: 'cust-1',
    orderNumber: 'PED-2026-000001',
    createdAt: new Date('2026-11-19T10:00:00Z'),
    status: 'ACCEPTED',
    paymentStatus: 'PENDING',
    fulfillmentStatus: 'PENDING',
    items: [
      {
        productId: 'p1',
        name: 'Booster Box (nombre histórico)',
        sku: 'booster-box',
        quantity: 2,
        unitPriceEur: 100,
        discountPercent: 10,
        discountAmountEur: 20,
        vatRate: 0.21,
        lineTotal: 180,
      },
    ],
    customerSnapshot: { ...customer, shippingAddress: 'Dirección de envío del pedido' },
    subtotal: 180,
    discountTotal: 20,
    shippingCost: 10,
    vatRate: 0.21,
    ivaAmount: 39.9,
    total: 229.9,
    customer,
    documents: [],
    ...over,
  };
}

let createdDoc: Record<string, unknown> | null;

beforeEach(() => {
  vi.resetAllMocks();
  createdDoc = null;
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
  mocks.db.sequence.update.mockResolvedValue({ value: 7 });
  mocks.db.b2bDocument.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    createdDoc = { ...data, id: 'doc-1', createdAt: new Date(), updatedAt: new Date('2026-11-19T17:00:00Z'), generatedAt: null, fileSize: null, lastError: null, correctsDocumentId: data.correctsDocumentId ?? null };
    return createdDoc;
  });
  mocks.db.b2bDocument.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...createdDoc, ...data }));
  mocks.put.mockResolvedValue(undefined);
  mocks.head.mockResolvedValue(null);
});

describe('file naming', () => {
  it('sanitizes the NIF/CIF and rejects unusable values', () => {
    expect(sanitizeTaxId(' b-12.345.678 ')).toBe('B12345678');
    expect(sanitizeTaxId('../../etc/passwd1')).toBe('ETCPASSWD1');
    expect(sanitizeTaxId('ABCDEF')).toBeNull();
    expect(sanitizeTaxId('')).toBeNull();
    expect(sanitizeTaxId(null)).toBeNull();
  });

  it('uses <NIF>_<YYYYMMDD>_<HHmmss>.pdf in Madrid time under a per-document folder', () => {
    const date = new Date('2026-11-19T17:30:45Z'); // 18:30:45 in Madrid (CET)
    const name = buildDocumentFileName('B12345678', date);
    expect(name).toBe('B12345678_20261119_183045.pdf');
    expect(buildDocumentStorageKey('INVOICE', 'FAC-2026-000007', name, date)).toBe(
      'invoices/2026/FAC-2026-000007/B12345678_20261119_183045.pdf'
    );
  });

  it('never leaks raw error messages', () => {
    const err = Object.assign(new Error('https://acct.r2.cloudflarestorage.com secret=abc'), { name: 'NetworkingError' });
    const msg = describeGenerationError('storage', err);
    expect(msg).toContain('NetworkingError');
    expect(msg).not.toMatch(/r2|secret|https/);
  });
});

describe('document payload & PDF', () => {
  it('is built from the order snapshot, never the live catalog', () => {
    const payload = buildDocumentPayload({
      type: 'INVOICE',
      number: 'FAC-2026-000007',
      issuedAt: new Date('2026-11-19T17:30:45Z'),
      order: makeOrder() as never,
      customer,
    });
    expect(payload.items[0].name).toBe('Booster Box (nombre histórico)');
    expect(payload.shippingAddress).toBe('Dirección de envío del pedido');
    expect(payload.vatBreakdown).toEqual([{ rate: 0.21, base: 190, amount: 39.9 }]);
    expect(payload.grossTotal).toBe(200);
    expect(payload.total).toBe(229.9);
    expect(mocks.db.product.findMany).not.toHaveBeenCalled();
  });

  it('includes Recargo de Equivalencia from the order snapshot and renders it', async () => {
    const order = makeOrder({ surchargeRate: 0.052, surchargeAmount: 9.88, total: 239.78 });
    const payload = buildDocumentPayload({
      type: 'INVOICE',
      number: 'FAC-1',
      issuedAt: new Date('2026-11-19T17:30:45Z'),
      order: order as never,
      customer,
    });
    expect(payload.equivalenceSurcharge).toEqual({ rate: 0.052, base: 190, amount: 9.88 });
    expect(payload.total).toBe(239.78);

    const pdf = await generateB2bDocumentPdf(payload);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');

    const plain = buildDocumentPayload({ type: 'INVOICE', number: 'FAC-2', issuedAt: new Date(), order: makeOrder() as never, customer });
    expect(plain.equivalenceSurcharge).toBeNull();
  });

  it('corrective invoices negate every amount and reference the original', () => {
    const payload = buildDocumentPayload({
      type: 'CORRECTIVE_INVOICE',
      number: 'RECT-2026-000001',
      issuedAt: new Date(),
      order: makeOrder() as never,
      customer,
      corrects: { number: 'FAC-2026-000007', issuedAt: new Date('2026-11-19T17:30:45Z') },
      correctionReason: 'Pedido devuelto',
    });
    expect(payload.total).toBe(-229.9);
    expect(payload.items[0]).toMatchObject({ quantity: -2, lineTotal: -180 });
    expect(payload.corrects?.number).toBe('FAC-2026-000007');
  });

  it('renders a valid multi-page PDF for every document type', async () => {
    const base = buildDocumentPayload({
      type: 'INVOICE',
      number: 'FAC-2026-000007',
      issuedAt: new Date(),
      order: makeOrder({
        items: Array.from({ length: 40 }, (_, i) => ({
          productId: `p${i}`,
          name: `Producto ${i} — ポケモン ünïcödé`,
          sku: `ref-${i}`,
          quantity: 1,
          unitPriceEur: 10,
          lineTotal: 10,
        })),
      }) as never,
      customer,
    });
    for (const type of ['INVOICE', 'PROFORMA', 'QUOTATION', 'CORRECTIVE_INVOICE'] as const) {
      const pdf = await generateB2bDocumentPdf({ ...base, type });
      expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe('%PDF-');
      expect(pdf.byteLength).toBeGreaterThan(2000);
    }
  });
});

describe('issueB2bDocument', () => {
  it('reserves a number, stores the PDF in the private bucket and persists metadata', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());

    const outcome = await issueB2bDocument({
      orderId: 'order-1',
      type: 'INVOICE',
      actor: 'admin:a@b.c',
      manualNumber: 'FAC-2026-000007',
    });

    expect(outcome.issued).toBe(true);
    const createData = mocks.db.b2bDocument.create.mock.calls[0][0].data;
    expect(createData).toMatchObject({
      orderId: 'order-1',
      customerId: 'cust-1',
      type: 'INVOICE',
      status: 'GENERATING',
      number: expect.stringMatching(/^FAC-\d{4}-000007$/),
      total: 229.9,
      uniquenessKey: 'order-1:INVOICE',
      createdBy: 'admin:a@b.c',
    });
    expect(createData.storageKey).toMatch(/^invoices\/\d{4}\/FAC-\d{4}-000007\/B12345678_\d{8}_\d{6}\.pdf$/);
    const [key, body] = mocks.put.mock.calls[0];
    expect(key).toBe(createData.storageKey);
    expect(Buffer.from((body as Uint8Array).slice(0, 5)).toString()).toBe('%PDF-');
    expect(mocks.db.b2bDocument.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ISSUED', fileSize: (body as Uint8Array).byteLength }) })
    );
    expect(mocks.db.b2bOrderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DOCUMENT_GENERATED' }) })
    );
  });

  it('prevents a duplicate final invoice without touching the number sequence', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(
      makeOrder({ documents: [{ id: 'inv', type: 'INVOICE', status: 'ISSUED', correctsDocumentId: null }] })
    );
    await expect(issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a' })).rejects.toMatchObject({ status: 409 });
    expect(mocks.db.sequence.update).not.toHaveBeenCalled();
  });

  it('maps a concurrent duplicate (unique violation) to 409', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());
    mocks.db.$transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(
      issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a', manualNumber: 'FAC-1' })
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('uses an admin-assigned number without consuming the series', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());
    mocks.db.b2bDocument.findUnique.mockResolvedValue(null);

    const outcome = await issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a', manualNumber: 'FAC-2026-EXT-42' });

    expect(outcome.issued).toBe(true);
    const data = mocks.db.b2bDocument.create.mock.calls[0][0].data;
    expect(data.number).toBe('FAC-2026-EXT-42');
    expect(data.payload.number).toBe('FAC-2026-EXT-42');
    expect(data.storageKey).toMatch(/^invoices\/\d{4}\/FAC-2026-EXT-42\//);
    expect(mocks.db.sequence.update).not.toHaveBeenCalled();
  });

  it('rejects a manual number already used by another document', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());
    mocks.db.b2bDocument.findUnique.mockResolvedValue({ id: 'other' });
    await expect(
      issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a', manualNumber: 'FAC-2026-000001' })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('FAC-2026-000001') });
    expect(mocks.db.b2bDocument.create).not.toHaveBeenCalled();
  });

  it('proforma auto-numbering skips numbers already assigned manually', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder({ status: 'PENDING' }));
    mocks.db.sequence.upsert.mockResolvedValueOnce({ value: 7 }).mockResolvedValueOnce({ value: 8 });
    mocks.db.b2bDocument.findUnique.mockResolvedValueOnce({ id: 'manual' }).mockResolvedValueOnce(null);

    await issueB2bDocument({ orderId: 'order-1', type: 'PROFORMA', actor: 'a' });

    expect(mocks.db.b2bDocument.create.mock.calls[0][0].data.number).toMatch(/^PRO-\d{4}-000008$/);
  });

  it('never auto-numbers fiscal invoices: a number is always required', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());
    await expect(issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a' })).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('número de factura'),
    });

    mocks.db.b2bOrder.findUnique.mockResolvedValue(
      makeOrder({ documents: [{ id: 'inv', type: 'INVOICE', status: 'ISSUED', correctsDocumentId: null }] })
    );
    await expect(
      issueB2bDocument({ orderId: 'order-1', type: 'CORRECTIVE_INVOICE', actor: 'a', correctsDocumentId: 'inv', correctionReason: 'x' })
    ).rejects.toMatchObject({ status: 422 });

    expect(mocks.db.sequence.update).not.toHaveBeenCalled();
    expect(mocks.db.sequence.upsert).not.toHaveBeenCalled();
    expect(mocks.db.b2bDocument.create).not.toHaveBeenCalled();
  });

  it('refuses customers without a valid NIF/CIF', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder({ customer: { ...customer, vatNumber: '---' } }));
    await expect(issueB2bDocument({ orderId: 'order-1', type: 'PROFORMA', actor: 'a' })).rejects.toMatchObject({ status: 422 });
    expect(mocks.db.b2bDocument.create).not.toHaveBeenCalled();
  });

  it('keeps the order and marks the document FAILED when the upload fails', async () => {
    mocks.db.b2bOrder.findUnique.mockResolvedValue(makeOrder());
    mocks.put.mockRejectedValueOnce(Object.assign(new Error('socket hang up'), { name: 'NetworkingError' }));

    const outcome = await issueB2bDocument({ orderId: 'order-1', type: 'INVOICE', actor: 'a', manualNumber: 'FAC-2' });

    expect(outcome.issued).toBe(false);
    expect(outcome.error).toMatch(/almacenamiento privado \(NetworkingError\)/);
    expect(mocks.db.b2bDocument.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'FAILED', lastError: outcome.error } })
    );
    expect(mocks.db.b2bOrderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DOCUMENT_GENERATION_FAILED' }) })
    );
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe('retryB2bDocument', () => {
  const failedDoc = (over: Record<string, unknown> = {}) => ({
    ...createdDoc,
    id: 'doc-1',
    orderId: 'order-1',
    type: 'INVOICE',
    number: 'FAC-2026-000007',
    status: 'FAILED',
    attempts: 1,
    issuedAt: new Date('2026-11-19T17:30:45Z'),
    updatedAt: new Date('2026-11-19T17:31:00Z'),
    payload: buildDocumentPayload({
      type: 'INVOICE',
      number: 'FAC-2026-000007',
      issuedAt: new Date('2026-11-19T17:30:45Z'),
      order: makeOrder() as never,
      customer,
    }),
    storageKey: 'invoices/2026/FAC-2026-000007/B12345678_20261119_183045.pdf',
    order: makeOrder(),
    correctsDocument: null,
    ...over,
  });

  it('reuses the same number and storage key (no duplicate file)', async () => {
    const doc = failedDoc();
    mocks.db.b2bDocument.findFirst.mockResolvedValue(doc);
    mocks.db.b2bDocument.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.b2bDocument.findUniqueOrThrow.mockResolvedValue({ ...doc, status: 'GENERATING', attempts: 2 });
    createdDoc = doc;

    const outcome = await retryB2bDocument({ orderId: 'order-1', documentId: 'doc-1', actor: 'a' });

    expect(outcome.issued).toBe(true);
    expect(mocks.db.b2bDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-1', status: 'FAILED', updatedAt: doc.updatedAt } })
    );
    expect(mocks.put).toHaveBeenCalledWith(doc.storageKey, expect.any(Uint8Array));
    expect(mocks.db.b2bOrderEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'DOCUMENT_GENERATION_RETRIED' }) })
    );
  });

  it('recovers a file uploaded by a previous attempt whose DB update failed', async () => {
    const doc = failedDoc();
    mocks.db.b2bDocument.findFirst.mockResolvedValue(doc);
    mocks.db.b2bDocument.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.b2bDocument.findUniqueOrThrow.mockResolvedValue({ ...doc, status: 'GENERATING', attempts: 2 });
    mocks.head.mockResolvedValue({ size: 4321 });
    createdDoc = doc;

    const outcome = await retryB2bDocument({ orderId: 'order-1', documentId: 'doc-1', actor: 'a' });

    expect(outcome.issued).toBe(true);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.db.b2bDocument.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ISSUED', fileSize: 4321 }) })
    );
  });

  it('never regenerates an issued document', async () => {
    mocks.db.b2bDocument.findFirst.mockResolvedValue(failedDoc({ status: 'ISSUED' }));
    await expect(retryB2bDocument({ orderId: 'order-1', documentId: 'doc-1', actor: 'a' })).rejects.toMatchObject({ status: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rejects a concurrent retry', async () => {
    mocks.db.b2bDocument.findFirst.mockResolvedValue(failedDoc());
    mocks.db.b2bDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(retryB2bDocument({ orderId: 'order-1', documentId: 'doc-1', actor: 'a' })).rejects.toMatchObject({ status: 409 });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('freezes payload and storage key for legacy invoices on first retry, keeping number and date', async () => {
    const doc = failedDoc({ payload: null, storageKey: null, attempts: 0 });
    mocks.db.b2bDocument.findFirst.mockResolvedValue(doc);
    mocks.db.b2bDocument.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.b2bDocument.findUniqueOrThrow.mockImplementation(async () => ({
      ...doc,
      ...mocks.db.b2bDocument.updateMany.mock.calls[0][0].data,
      attempts: 1,
      status: 'GENERATING',
    }));
    createdDoc = doc;

    const outcome = await retryB2bDocument({ orderId: 'order-1', documentId: 'doc-1', actor: 'a' });

    expect(outcome.issued).toBe(true);
    const data = mocks.db.b2bDocument.updateMany.mock.calls[0][0].data;
    expect(data.storageKey).toBe('invoices/2026/FAC-2026-000007/B12345678_20261119_183045.pdf');
    expect(data.payload.number).toBe('FAC-2026-000007');
  });
});
