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
});
