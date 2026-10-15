import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findPending: vi.fn(),
  createRequest: vi.fn(),
  findRequest: vi.fn(),
  updateRequest: vi.fn(),
  findCustomer: vi.fn(),
  createCustomer: vi.fn(),
  createToken: vi.fn(),
  invalidateTokens: vi.fn(),
  transaction: vi.fn(),
  docsEmail: vi.fn(),
  adminEmail: vi.fn(),
  activationEmail: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    b2bRequest: {
      findFirst: mocks.findPending,
      create: mocks.createRequest,
      findUnique: mocks.findRequest,
    },
    b2bCustomer: { findUnique: mocks.findCustomer },
    b2bActivationToken: {
      updateMany: mocks.invalidateTokens,
      create: mocks.createToken,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/b2b/admin-auth', () => ({ isAdminAuthenticated: () => true }));
vi.mock('@/lib/b2b/emails', () => ({
  sendB2bDocumentationRequestEmail: mocks.docsEmail,
  sendB2bRequestAdminNotification: mocks.adminEmail,
  sendB2bActivationEmail: mocks.activationEmail,
}));
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }));

import { POST as requestAccess } from '@/app/api/b2b/request/route';
import { POST as approve } from '@/app/api/admin/b2b/requests/[id]/approve/route';
import { POST as resend } from '@/app/api/admin/b2b/customers/[id]/resend-activation/route';

const customer = {
  id: 'customer-1',
  email: 'buyer@example.com',
  contactName: 'Buyer',
  companyName: 'Card Shop',
  status: 'PENDING',
};
const context = { params: Promise.resolve({ id: 'request-1' }) };

function request(path: string, body?: object) {
  return new NextRequest(`https://shop.example.com${path}`, {
    method: 'POST',
    ...(body && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
}

function deferredEmail() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
  mocks.findRequest.mockResolvedValue({
    ...customer,
    id: 'request-1',
    vatNumber: 'B12345678',
    activity: 'RETAIL',
    shippingAddress: 'Test Street',
    phone: '600000000',
  });
  mocks.createCustomer.mockResolvedValue(customer);
  mocks.transaction.mockImplementation(async (operation) => {
    if (typeof operation === 'function') {
      return operation({
        b2bCustomer: { create: mocks.createCustomer },
        b2bActivationToken: { create: mocks.createToken },
        b2bRequest: { update: mocks.updateRequest },
      });
    }
    return Promise.all(operation);
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('B2B access request notification', () => {
  it('waits for both emails and sends the admin the public origin', async () => {
    const docs = deferredEmail();
    const admin = deferredEmail();
    mocks.docsEmail.mockReturnValue(docs.promise);
    mocks.adminEmail.mockReturnValue(admin.promise);
    const finished = vi.fn();
    const response = requestAccess(request('/api/b2b/request', { email: ' Buyer@Example.com ' }))
      .then((result) => { finished(); return result; });

    await vi.waitFor(() => expect(mocks.adminEmail).toHaveBeenCalledWith(
      'buyer@example.com', 'https://shop.example.com'
    ));
    expect(finished).not.toHaveBeenCalled();
    docs.resolve();
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    admin.resolve();
    expect((await response).status).toBe(201);
  });

  it('preserves the application and captures each failed email', async () => {
    const error = new Error('SMTP unavailable');
    mocks.adminEmail.mockRejectedValue(error);
    const response = await requestAccess(request('/api/b2b/request', { email: customer.email }));
    expect(response.status).toBe(201);
    expect(mocks.createRequest).toHaveBeenCalledOnce();
    expect(mocks.docsEmail).toHaveBeenCalledWith(customer.email);
    expect(mocks.captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      tags: { module: 'b2b', action: 'admin_email' },
    }));
  });

  it('does not duplicate requests or notifications for pending applications', async () => {
    mocks.findPending.mockResolvedValue({ id: 'request-1' });
    expect((await requestAccess(request('/api/b2b/request', { email: customer.email }))).status).toBe(200);
    expect(mocks.createRequest).not.toHaveBeenCalled();
    expect(mocks.adminEmail).not.toHaveBeenCalled();
  });
});

describe('B2B approval and activation resend', () => {
  it('waits for approval email and returns the same working URL in the response', async () => {
    const email = deferredEmail();
    mocks.activationEmail.mockReturnValue(email.promise);
    const finished = vi.fn();
    const response = approve(request('/api/admin/b2b/requests/request-1/approve'), context)
      .then((result) => { finished(); return result; });
    await vi.waitFor(() => expect(mocks.activationEmail).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    email.resolve();

    const body = await (await response).json();
    expect(body.emailSent).toBe(true);
    expect(body.activationLink).toMatch(/^https:\/\/shop\.example\.com\/b2b\/activar\/[A-Za-z0-9_-]{43}$/);
    expect(mocks.activationEmail).toHaveBeenCalledWith(expect.objectContaining({
      activationUrl: body.activationLink,
    }));
  });

  it('reports email failure without pretending the approved account was rolled back', async () => {
    mocks.activationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    const response = await approve(request('/api/admin/b2b/requests/request-1/approve'), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, emailSent: false });
    expect(mocks.captureException).toHaveBeenCalledOnce();
  });

  it('validates the URL before committing approval', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'invalid-url');
    const response = await approve(request('/api/admin/b2b/requests/request-1/approve'), context);
    expect(response.status).toBe(500);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('waits for resend and generates a public activation URL', async () => {
    mocks.findCustomer.mockResolvedValue(customer);
    const email = deferredEmail();
    mocks.activationEmail.mockReturnValue(email.promise);
    const finished = vi.fn();
    const response = resend(request('/api/admin/b2b/customers/customer-1/resend-activation'), context)
      .then((result) => { finished(); return result; });
    await vi.waitFor(() => expect(mocks.activationEmail).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    email.resolve();
    const body = await (await response).json();
    expect(body.activationLink).toMatch(/^https:\/\/shop\.example\.com\/b2b\/activar\//);
    expect(mocks.activationEmail).toHaveBeenCalledWith(expect.objectContaining({
      activationUrl: body.activationLink,
    }));
  });

  it('returns an error and captures failed resend delivery', async () => {
    mocks.findCustomer.mockResolvedValue(customer);
    mocks.activationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    const response = await resend(request('/api/admin/b2b/customers/customer-1/resend-activation'), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toHaveProperty('error');
    expect(mocks.captureException).toHaveBeenCalledOnce();
  });
});
