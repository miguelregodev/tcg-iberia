/**
 * Route-level tests for B2B order management: admin-only access, request
 * validation, document generation wiring, shipment notification and
 * customer document authorization (ownership / ID tampering).
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getCustomer: vi.fn(),
  customerFind: vi.fn(),
  documentFind: vi.fn(),
  documentFindUnique: vi.fn(),
  createOrder: vi.fn(),
  acceptOrder: vi.fn(),
  issueDocument: vi.fn(),
  emailDocument: vi.fn(),
  readPdf: vi.fn(),
  updateFulfillment: vi.fn(),
  sendShipping: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    b2bCustomer: { findUnique: mocks.customerFind },
    b2bDocument: { findFirst: mocks.documentFind, findUnique: mocks.documentFindUnique },
  },
}));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));
vi.mock('@/lib/b2b/admin-auth', () => ({
  isAdminAuthenticated: mocks.isAdmin,
  getAdminActor: () => 'admin:admin@example.com',
}));
vi.mock('@/lib/b2b/session', () => ({ getActiveB2bCustomer: mocks.getCustomer }));
vi.mock('@/lib/b2b/orders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/b2b/orders')>()),
  createB2bOrder: mocks.createOrder,
  acceptB2bOrder: mocks.acceptOrder,
  updateB2bFulfillment: mocks.updateFulfillment,
  sendB2bShippingNotification: mocks.sendShipping,
}));
vi.mock('@/lib/b2b/documents', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/b2b/documents')>()),
  issueB2bDocument: mocks.issueDocument,
  emailB2bDocument: mocks.emailDocument,
  readIssuedDocumentPdf: mocks.readPdf,
}));

import { POST as adminCreate } from '@/app/api/admin/b2b/orders/route';
import { POST as adminFulfillment } from '@/app/api/admin/b2b/orders/[id]/fulfillment/route';
import { POST as adminAccept } from '@/app/api/admin/b2b/orders/[id]/accept/route';
import { GET as adminDocument } from '@/app/api/admin/b2b/orders/[id]/documents/[documentId]/route';
import { GET as customerDocument } from '@/app/api/b2b/orders/[id]/documents/[documentId]/route';
import { B2bServiceError } from '@/lib/b2b/errors';

const json = (path: string, body: unknown) =>
  new NextRequest(`https://shop.example.com${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
const get = (path: string) => new NextRequest(`https://shop.example.com${path}`);

const validBody = {
  customerId: 'cust-1',
  items: [{ productId: 'p1', quantity: 2, discountPercent: 5 }],
  shippingCost: 9.5,
  document: 'NONE',
  idempotencyKey: '0b6f2f0e-9d7c-4c2b-9a51-0e1d3c1f7a11',
};
const order = { id: 'o1', orderNumber: 'PED-2026-000009', total: 100 };
const docContext = (id: string, documentId: string) => ({ params: Promise.resolve({ id, documentId }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAdmin.mockReturnValue(true);
  mocks.customerFind.mockResolvedValue({ id: 'cust-1', status: 'ACTIVE' });
  mocks.createOrder.mockResolvedValue({ order, duplicate: false, pricing: {} });
});

describe('admin order creation', () => {
  it('rejects non-admin users', async () => {
    mocks.isAdmin.mockReturnValue(false);
    const res = await adminCreate(json('/api/admin/b2b/orders', validBody));
    expect(res.status).toBe(401);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it('validates quantities and never forwards client prices', async () => {
    const res = await adminCreate(
      json('/api/admin/b2b/orders', { ...validBody, items: [{ productId: 'p1', quantity: 0, unitPriceEur: 0.01 }] })
    );
    expect(res.status).toBe(400);
    expect(mocks.createOrder).not.toHaveBeenCalled();

    await adminCreate(json('/api/admin/b2b/orders', { ...validBody, items: [{ productId: 'p1', quantity: 2, unitPriceEur: 0.01 }] }));
    expect(mocks.createOrder.mock.calls[0][0].lines).toEqual([{ productId: 'p1', quantity: 2, discountPercent: 0 }]);
  });

  it('requires an idempotency key and refuses disabled customers', async () => {
    expect((await adminCreate(json('/api/admin/b2b/orders', { ...validBody, idempotencyKey: '' }))).status).toBe(400);
    mocks.customerFind.mockResolvedValue({ id: 'cust-1', status: 'DISABLED' });
    expect((await adminCreate(json('/api/admin/b2b/orders', validBody))).status).toBe(409);
  });

  it('creates the order without any document when none is requested', async () => {
    const res = await adminCreate(json('/api/admin/b2b/orders', validBody));
    expect(res.status).toBe(201);
    expect(mocks.createOrder.mock.calls[0][0]).toMatchObject({
      source: 'ADMIN',
      initialStatus: 'ACCEPTED',
      shippingCostCents: 950,
      actor: 'admin:admin@example.com',
    });
    expect(mocks.issueDocument).not.toHaveBeenCalled();
    expect((await res.json()).document).toBeNull();
  });

  it('generates the invoice right after creating the order and emails it when asked', async () => {
    mocks.issueDocument.mockResolvedValue({
      document: { id: 'd1', number: 'FAC-2026-000001', status: 'ISSUED' },
      issued: true,
      pdf: new Uint8Array([1]),
      error: null,
    });
    mocks.emailDocument.mockResolvedValue({ sent: true, error: null });
    mocks.documentFindUnique.mockResolvedValue(null);
    const res = await adminCreate(
      json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: 'FAC-2026-000001', notifyCustomer: true })
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(mocks.issueDocument).toHaveBeenCalledWith({
      orderId: 'o1',
      type: 'INVOICE',
      actor: 'admin:admin@example.com',
      manualNumber: 'FAC-2026-000001',
    });
    expect(body.document).toMatchObject({ number: 'FAC-2026-000001', status: 'ISSUED' });
    expect(mocks.emailDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'd1', pdf: expect.any(Uint8Array) }));
  });

  it('passes a valid manual invoice number to the document service', async () => {
    mocks.documentFindUnique.mockResolvedValue(null);
    mocks.issueDocument.mockResolvedValue({ document: { id: 'd', number: 'FAC-EXT-7', status: 'ISSUED' }, issued: true, pdf: null, error: null });
    const res = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: ' fac-ext-7 ' }));
    expect(res.status).toBe(201);
    expect(mocks.issueDocument).toHaveBeenCalledWith(expect.objectContaining({ manualNumber: 'FAC-EXT-7' }));
  });

  it('rejects invalid or already used manual numbers before creating the order', async () => {
    const bad = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: '../x y' }));
    expect(bad.status).toBe(400);
    mocks.documentFindUnique.mockResolvedValue({ id: 'existing' });
    const dup = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: 'FAC-2026-000001' }));
    expect(dup.status).toBe(409);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it('quotations start as pending orders', async () => {
    mocks.issueDocument.mockResolvedValue({ document: { id: 'd', number: 'PRES-1', status: 'ISSUED' }, issued: true, pdf: null, error: null });
    await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'QUOTATION' }));
    expect(mocks.createOrder.mock.calls[0][0].initialStatus).toBe('PENDING');
  });

  it('requires an invoice number for invoices and never creates the order without it', async () => {
    const res = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/número de factura/);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it('keeps the order when document generation fails', async () => {
    mocks.documentFindUnique.mockResolvedValue(null);
    mocks.issueDocument.mockRejectedValue(new B2bServiceError('El cliente no tiene un NIF/CIF válido.', 422));
    const res = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: 'FAC-9' }));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.order.id).toBe('o1');
    expect(body.document).toMatchObject({ status: 'FAILED', error: 'El cliente no tiene un NIF/CIF válido.' });
  });

  it('does not re-generate documents for an idempotent retry', async () => {
    mocks.createOrder.mockResolvedValue({ order, duplicate: true, pricing: {} });
    const res = await adminCreate(json('/api/admin/b2b/orders', { ...validBody, document: 'INVOICE', documentNumber: 'FAC-9' }));
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(mocks.issueDocument).not.toHaveBeenCalled();
  });
});

describe('admin accept with invoice', () => {
  const ctx = { params: Promise.resolve({ id: 'o1' }) };

  it('requires a valid, unused invoice number before confirming the order', async () => {
    let res = await adminAccept(json('/api/admin/b2b/orders/o1/accept', { generateInvoice: true }), ctx);
    expect(res.status).toBe(400);
    res = await adminAccept(json('/api/admin/b2b/orders/o1/accept', { generateInvoice: true, invoiceNumber: 'bad number!' }), ctx);
    expect(res.status).toBe(400);
    mocks.documentFindUnique.mockResolvedValue({ id: 'used' });
    res = await adminAccept(json('/api/admin/b2b/orders/o1/accept', { generateInvoice: true, invoiceNumber: 'FAC-1' }), ctx);
    expect(res.status).toBe(409);
    expect(mocks.acceptOrder).not.toHaveBeenCalled();
  });

  it('confirms and issues the invoice with the admin number', async () => {
    mocks.documentFindUnique.mockResolvedValue(null);
    mocks.acceptOrder.mockResolvedValue({ id: 'o1', status: 'ACCEPTED', customer: {}, items: [], subtotal: 0, ivaAmount: 0, total: 0 });
    mocks.issueDocument.mockResolvedValue({ document: { id: 'd', number: 'FAC-77', status: 'ISSUED' }, issued: true, pdf: null, error: null });
    const res = await adminAccept(
      json('/api/admin/b2b/orders/o1/accept', { generateInvoice: true, invoiceNumber: 'fac-77', notifyCustomer: false }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(mocks.issueDocument).toHaveBeenCalledWith(expect.objectContaining({ type: 'INVOICE', manualNumber: 'FAC-77' }));
  });

  it('confirms without invoice by default', async () => {
    mocks.acceptOrder.mockResolvedValue({ id: 'o1', status: 'ACCEPTED' });
    const res = await adminAccept(json('/api/admin/b2b/orders/o1/accept', {}), ctx);
    expect(res.status).toBe(200);
    expect(mocks.issueDocument).not.toHaveBeenCalled();
  });
});

describe('admin shipment', () => {
  const ctx = { params: Promise.resolve({ id: 'o1' }) };

  it('notifies the customer after a successful shipment, and an email failure does not undo it', async () => {
    mocks.updateFulfillment.mockResolvedValue({ order: { id: 'o1', fulfillmentStatus: 'SHIPPED' }, shouldNotify: true });
    mocks.sendShipping.mockResolvedValue({ sent: false, error: 'No se pudo enviar el email de envío (SMTPError).' });

    const res = await adminFulfillment(
      json('/api/admin/b2b/orders/o1/fulfillment', { status: 'SHIPPED', trackingNumber: 'PK1234', shippingProvider: 'CORREOS' }),
      ctx
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.order.fulfillmentStatus).toBe('SHIPPED');
    expect(body.email).toEqual({ sent: false, error: expect.stringContaining('SMTPError') });
    expect(mocks.updateFulfillment.mock.invocationCallOrder[0]).toBeLessThan(mocks.sendShipping.mock.invocationCallOrder[0]);
  });

  it('does not email when the shipment update is rejected', async () => {
    mocks.updateFulfillment.mockRejectedValue(new B2bServiceError('Selecciona un proveedor logístico válido.', 422));
    const res = await adminFulfillment(json('/api/admin/b2b/orders/o1/fulfillment', { status: 'SHIPPED' }), ctx);
    expect(res.status).toBe(422);
    expect(mocks.sendShipping).not.toHaveBeenCalled();
  });

  it('rejects non-admin users', async () => {
    mocks.isAdmin.mockReturnValue(false);
    const res = await adminFulfillment(json('/api/admin/b2b/orders/o1/fulfillment', { status: 'DELIVERED' }), ctx);
    expect(res.status).toBe(401);
  });
});

describe('document downloads', () => {
  it('customers can download their own issued documents (streamed, no storage key exposed)', async () => {
    mocks.getCustomer.mockResolvedValue({ id: 'cust-1' });
    mocks.documentFind.mockResolvedValue({ number: 'FAC-2026-000001', status: 'ISSUED', storageKey: 'invoices/2026/FAC/B1_x.pdf' });
    mocks.readPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));

    const res = await customerDocument(get('/api/b2b/orders/o1/documents/d1'), docContext('o1', 'd1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="FAC-2026-000001.pdf"');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(JSON.stringify([...res.headers.entries()])).not.toContain('invoices/');
    expect(mocks.documentFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'd1', orderId: 'o1', customerId: 'cust-1', status: 'ISSUED', order: { customerId: 'cust-1' } },
      })
    );
  });

  it("customers cannot download another customer's document by tampering IDs", async () => {
    mocks.getCustomer.mockResolvedValue({ id: 'cust-2' });
    mocks.documentFind.mockResolvedValue(null);
    const res = await customerDocument(get('/api/b2b/orders/o1/documents/d1'), docContext('o1', 'd1'));
    expect(res.status).toBe(404);
    expect(mocks.readPdf).not.toHaveBeenCalled();
    expect(mocks.documentFind.mock.calls[0][0].where.customerId).toBe('cust-2');
  });

  it('anonymous users get 401', async () => {
    mocks.getCustomer.mockResolvedValue(null);
    const res = await customerDocument(get('/api/b2b/orders/o1/documents/d1'), docContext('o1', 'd1'));
    expect(res.status).toBe(401);
    expect(mocks.documentFind).not.toHaveBeenCalled();
  });

  it('admins can access any order document; non-admins cannot use the admin endpoint', async () => {
    mocks.documentFind.mockResolvedValue({ number: 'PRO-2026-000001', status: 'ISSUED', storageKey: 'k' });
    mocks.readPdf.mockResolvedValue(new Uint8Array([1]));
    const ok = await adminDocument(get('/api/admin/b2b/orders/o9/documents/d9?download=1'), docContext('o9', 'd9'));
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Content-Disposition')).toContain('attachment');
    expect(mocks.documentFind.mock.calls[0][0].where).toEqual({ id: 'd9', orderId: 'o9' });

    mocks.isAdmin.mockReturnValue(false);
    const denied = await adminDocument(get('/api/admin/b2b/orders/o9/documents/d9'), docContext('o9', 'd9'));
    expect(denied.status).toBe(401);
  });

  it('documents that are not issued yet cannot be downloaded', async () => {
    mocks.documentFind.mockResolvedValue({ number: 'FAC-1', status: 'FAILED', storageKey: null });
    mocks.readPdf.mockRejectedValue(new B2bServiceError('El documento no está disponible.', 409));
    const res = await adminDocument(get('/api/admin/b2b/orders/o1/documents/d1'), docContext('o1', 'd1'));
    expect(res.status).toBe(409);
  });
});
