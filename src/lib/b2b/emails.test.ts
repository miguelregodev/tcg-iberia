import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, createTransport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock('nodemailer', () => ({ createTransport }));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  Reflect.deleteProperty(globalThis, '_tcgMailer');
  createTransport.mockReturnValue({ sendMail });
  vi.stubEnv('SMTP_HOST', 'smtp.example.com');
  vi.stubEnv('SMTP_PORT', '587');
  vi.stubEnv('SMTP_USER', 'test');
  vi.stubEnv('SMTP_PASSWORD', 'test');
  vi.stubEnv('ADMIN_EMAIL', 'admin@example.com');
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, '_tcgMailer');
});

describe('B2B email transport and links', () => {
  it('sends new request notifications to ADMIN_EMAIL with a public admin link', async () => {
    const { sendB2bRequestAdminNotification } = await import('./emails');
    await sendB2bRequestAdminNotification('buyer@example.com', 'https://shop.example.com');
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@example.com',
      replyTo: 'buyer@example.com',
      html: expect.stringContaining('href="https://shop.example.com/admin/b2b"'),
      text: expect.stringContaining('https://shop.example.com/admin/b2b'),
    }));
  });

  it('places the identical activation URL in the button and plain text email', async () => {
    const { sendB2bActivationEmail } = await import('./emails');
    const activationUrl = 'https://shop.example.com/b2b/activar/test-token';
    await sendB2bActivationEmail({
      email: 'buyer@example.com',
      contactName: 'Buyer',
      companyName: 'Card Shop',
      activationUrl,
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'buyer@example.com',
      html: expect.stringContaining(`href="${activationUrl}"`),
      text: expect.stringContaining(activationUrl),
    }));
  });

  it('rejects missing SMTP configuration instead of reporting a successful send', async () => {
    vi.stubEnv('SMTP_HOST', '');
    const { sendB2bActivationEmail } = await import('./emails');
    await expect(sendB2bActivationEmail({
      email: 'buyer@example.com',
      contactName: 'Buyer',
      companyName: 'Card Shop',
      activationUrl: 'https://shop.example.com/b2b/activar/test-token',
      expiresAt: new Date(),
    })).rejects.toThrow('SMTP env vars missing');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('shows Recargo de Equivalencia in order emails only when it applies', async () => {
    const { sendB2bOrderRequestEmail } = await import('./emails');
    const base = {
      orderNumber: 'PED-1',
      customerCompany: 'Card Shop',
      customerEmail: 'buyer@example.com',
      contactName: 'Buyer',
      items: [{ name: 'Box', quantity: 1, unitPriceEur: 100, lineTotal: 100 }],
      subtotal: 100,
      ivaAmount: 21,
    };
    await sendB2bOrderRequestEmail({ ...base, surchargeRate: 0.052, surchargeAmount: 5.2, total: 126.2 });
    expect(sendMail.mock.calls[0][0].html).toContain('Recargo de Equivalencia 5,2%');
    sendMail.mockClear();
    await sendB2bOrderRequestEmail({ ...base, total: 121 });
    expect(sendMail.mock.calls[0][0].html).not.toContain('Recargo de Equivalencia');
  });

  it('sends the shipped email with carrier, tracking number, tracking link and order link', async () => {
    const { sendB2bOrderShippedEmail } = await import('./emails');
    await sendB2bOrderShippedEmail({
      to: 'buyer@example.com',
      contactName: 'Buyer',
      companyName: 'Card Shop',
      orderNumber: 'PED-2026-000001',
      shippingProvider: 'CORREOS',
      trackingNumber: 'PK123456789ES',
      orderUrl: 'https://shop.example.com/mi-cuenta/b2b/pedidos?pedido=o1',
    });
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('buyer@example.com');
    expect(mail.subject).toContain('PED-2026-000001');
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain('Correos');
      expect(body).toContain('PK123456789ES');
      expect(body).toContain('correos.es');
      expect(body).toContain('https://shop.example.com/mi-cuenta/b2b/pedidos?pedido=o1');
    }
  });

  it('omits the tracking link for carriers without tracking URL support and propagates SMTP failures', async () => {
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    const { sendB2bOrderShippedEmail } = await import('./emails');
    await expect(sendB2bOrderShippedEmail({
      to: 'buyer@example.com',
      contactName: 'Buyer',
      companyName: 'Card Shop',
      orderNumber: 'PED-2026-000002',
      shippingProvider: 'MRW',
      trackingNumber: 'MRW-1',
      orderUrl: 'https://shop.example.com/x',
    })).rejects.toThrow('smtp down');
    const mail = sendMail.mock.calls[0][0];
    expect(mail.html).toContain('MRW');
    expect(mail.html).not.toContain('Seguir envío');
  });
});
