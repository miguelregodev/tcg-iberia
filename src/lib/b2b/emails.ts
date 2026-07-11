/**
 * B2B email templates.
 *
 * Reuses the corporate branding constants of the main email module
 * (`src/lib/email.ts`) and the same transporter, so all outbound mail shares
 * one SMTP connection pool and one consistent look.
 *
 * Three transactional emails:
 *   1. sendB2bDocumentationRequestEmail — sent when a prospect submits the
 *      "Request a B2B account" form. Requests the documentation the admin
 *      needs to approve the account.
 *   2. sendB2bActivationEmail — sent after the admin approves the request.
 *      Contains the one-time activation link so the customer can set their
 *      password.
 *   3. sendB2bAccountReadyEmail — sent after the customer successfully sets
 *      their password. Confirms that the account is fully active.
 *
 * Optional emails (kept behind their own exports because the spec marks them
 * as optional): sendB2bAccountDisabledEmail, sendB2bAccountReactivatedEmail.
 */

import * as nodemailer from 'nodemailer';

// ── Shared branding (mirror of src/lib/email.ts) ────────────────────────────
const BRAND = {
  primary: '#DC2626',
  primaryDark: '#B91C1C',
  primaryLight: '#FEF2F2',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
};

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif";

// ── Transporter (shared with the main email module) ──────────────────────────
type Cached = { transporter: nodemailer.Transporter | null };
const globalForMailer = global as unknown as { _tcgMailer?: Cached };
if (!globalForMailer._tcgMailer) globalForMailer._tcgMailer = { transporter: null };

function getTransporter(): nodemailer.Transporter | null {
  if (globalForMailer._tcgMailer!.transporter) {
    return globalForMailer._tcgMailer!.transporter;
  }
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !port || !user || !pass) {
    console.warn(
      '[b2b/emails] SMTP env vars missing — emails will not be sent. ' +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.'
    );
    return null;
  }
  const portNumber = Number(port);
  const transporter = nodemailer.createTransport({
    host,
    port: portNumber,
    secure: portNumber === 465,
    auth: { user, pass },
  });
  globalForMailer._tcgMailer!.transporter = transporter;
  return transporter;
}

function escapeHtml(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Shared email shell ──────────────────────────────────────────────────────
function htmlShell(title: string, contentHtml: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT_STACK};color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%);padding:32px 32px 28px 32px;text-align:left;">
              <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.18em;color:rgba(255,255,255,0.85);text-transform:uppercase;font-weight:600;">TCG Iberia · B2B</div>
              <div style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.white};margin-top:8px;line-height:1.2;">${escapeHtml(title)}</div>
            </td>
          </tr>
          ${contentHtml}
          <tr>
            <td style="padding:24px 32px;border-top:1px solid ${BRAND.border};background:${BRAND.bg};">
              <div style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.textMuted};line-height:1.6;text-align:center;">
                &copy; ${new Date().getFullYear()} TCG Iberia &middot; Departamento comercial B2B<br/>
                Si tienes cualquier duda, escríbenos a <a href="mailto:${escapeHtml(process.env.ADMIN_EMAIL || 'sales@tcgiberia.com')}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(process.env.ADMIN_EMAIL || 'sales@tcgiberia.com')}</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function primaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${BRAND.primary}" style="border-radius:10px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;background:${BRAND.primary};color:${BRAND.white};font-family:${FONT_STACK};font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Sent to the prospect right after they submit the "Request a B2B account"
 * form. Requests the documentation the admin needs to approve the account.
 */
export async function sendB2bDocumentationRequestEmail(email: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const salesEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const content = `
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          Hola,
        </p>
        <p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
          Gracias por tu interés en la sección <strong>B2B de TCG Iberia</strong>. Hemos recibido tu solicitud correctamente.
        </p>
        <p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
          Para activar tu cuenta y ofrecerte nuestras tarifas mayoristas, necesitamos verificar que tu negocio cumple con los requisitos legales. Por favor, respóndenos a este mismo correo adjuntando la siguiente información:
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 8px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.bg};">
          <tr>
            <td style="padding:20px 22px;">
              <ol style="margin:0;padding-left:20px;font-family:${FONT_STACK};font-size:14px;line-height:1.9;color:${BRAND.text};">
                <li><strong>Modelo 036</strong> (Declaración censal de alta en Hacienda)</li>
                <li><strong>Razón social</strong> completa</li>
                <li><strong>NIF / CIF / VAT ID</strong></li>
                <li><strong>Tipo de actividad</strong>: tienda online, operador de vending, tienda física, distribuidor, etc.</li>
                <li><strong>Dirección de envío</strong></li>
                <li><strong>Dirección de facturación</strong> (si es distinta a la de envío)</li>
                <li><strong>Nombre completo de la persona de contacto</strong></li>
                <li><strong>DNI / NIE / Pasaporte</strong> de la persona de contacto</li>
                <li><strong>Teléfono de contacto</strong></li>
                <li><strong>Email de contacto</strong></li>
                <li>Sitio web de la empresa <em>(opcional)</em></li>
                <li>Volumen mensual estimado de compras <em>(opcional pero recomendable)</em></li>
                <li>Idiomas preferentes</li>
                <li>Cualquier otra información relevante sobre tu negocio</li>
              </ol>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 32px 8px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 12px 0;">
          Una vez recibida y revisada la documentación, activaremos tu cuenta y te enviaremos un enlace seguro para que definas tu contraseña.
        </p>
        <p style="margin:0 0 12px 0;">
          Para cualquier consulta puedes escribirnos a <a href="mailto:${escapeHtml(salesEmail)}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${escapeHtml(salesEmail)}</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 32px 32px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        Un saludo,<br/>
        <strong>Equipo comercial de TCG Iberia</strong>
      </td>
    </tr>
  `;

  const text = [
    'Hola,',
    '',
    'Gracias por tu interés en la sección B2B de TCG Iberia. Hemos recibido tu solicitud correctamente.',
    '',
    'Para activar tu cuenta necesitamos verificar tu negocio. Por favor respóndenos a este correo con:',
    '  1. Modelo 036 (Declaración censal de alta en Hacienda)',
    '  2. Razón social completa',
    '  3. NIF / CIF / VAT ID',
    '  4. Tipo de actividad (tienda online, vending, tienda física, distribuidor…)',
    '  5. Dirección de envío',
    '  6. Dirección de facturación (si es distinta)',
    '  7. Nombre completo de la persona de contacto',
    '  8. DNI / NIE / Pasaporte',
    '  9. Teléfono de contacto',
    ' 10. Email de contacto',
    ' 11. Sitio web (opcional)',
    ' 12. Volumen mensual estimado (opcional pero recomendable)',
    ' 13. Idiomas preferentes',
    ' 14. Cualquier otra información relevante',
    '',
    'Cuando validemos la documentación te enviaremos un enlace seguro para que definas tu contraseña.',
    `Cualquier duda: ${salesEmail}`,
    '',
    'Equipo comercial de TCG Iberia',
  ].join('\n');

  await transporter.sendMail({
    from,
    to: email,
    replyTo: salesEmail,
    subject: 'TCG Iberia B2B · Solicitud de documentación',
    html: htmlShell('Documentación necesaria para activar tu cuenta', content),
    text,
  });
}

/**
 * Sent after the admin approves a request and the customer has been created.
 * Contains the one-time activation URL.
 */
export async function sendB2bActivationEmail(params: {
  email: string;
  contactName: string;
  companyName: string;
  activationUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const salesEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const expiresText = params.expiresAt.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });

  const content = `
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          Hola ${escapeHtml(params.contactName)},
        </p>
        <p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
          Tenemos buenas noticias: hemos aprobado la cuenta B2B de <strong>${escapeHtml(params.companyName)}</strong> y ya puedes empezar a acceder a nuestras tarifas mayoristas.
        </p>
        <p style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
          Para completar la activación, define tu contraseña haciendo clic en el siguiente botón:
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 32px 24px 32px;">
        ${primaryButton('Definir mi contraseña', params.activationUrl)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 16px 32px;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.textMuted};">
        Este enlace expira el <strong>${escapeHtml(expiresText)}</strong>. Si expira, escríbenos a
        <a href="mailto:${escapeHtml(salesEmail)}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(salesEmail)}</a>
        y te enviaremos uno nuevo.
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px 32px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.textMuted};word-break:break-all;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
        <span style="color:${BRAND.text};">${escapeHtml(params.activationUrl)}</span>
      </td>
    </tr>
  `;

  const text = [
    `Hola ${params.contactName},`,
    '',
    `Hemos aprobado la cuenta B2B de "${params.companyName}".`,
    '',
    'Para activarla, define tu contraseña en este enlace:',
    params.activationUrl,
    '',
    `El enlace expira el ${expiresText}.`,
    '',
    `Cualquier duda: ${salesEmail}`,
    '',
    'Equipo comercial de TCG Iberia',
  ].join('\n');

  await transporter.sendMail({
    from,
    to: params.email,
    replyTo: salesEmail,
    subject: 'TCG Iberia B2B · Activa tu cuenta',
    html: htmlShell('Activa tu cuenta B2B', content),
    text,
  });
}

/**
 * Sent right after the customer successfully sets their password. Confirms
 * that the account is fully active.
 */
export async function sendB2bAccountReadyEmail(params: {
  email: string;
  contactName: string;
  companyName: string;
  loginUrl: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const salesEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const content = `
    <tr>
      <td style="padding:32px 32px 8px 32px;">
        <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          ¡Hola ${escapeHtml(params.contactName)}!
        </p>
        <p style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
          Tu cuenta B2B de <strong>${escapeHtml(params.companyName)}</strong> ya está totalmente activa. Puedes iniciar sesión en cualquier momento desde la web:
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 32px 24px 32px;">
        ${primaryButton('Iniciar sesión', params.loginUrl)}
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        Recuerda que las tarifas mayoristas solo son visibles cuando estás autenticado. Si tienes cualquier duda o quieres coordinar un pedido especial, escríbenos a
        <a href="mailto:${escapeHtml(salesEmail)}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(salesEmail)}</a>.
      </td>
    </tr>
  `;

  const text = [
    `¡Hola ${params.contactName}!`,
    '',
    `Tu cuenta B2B de "${params.companyName}" ya está totalmente activa.`,
    `Inicia sesión aquí: ${params.loginUrl}`,
    '',
    'Las tarifas mayoristas solo son visibles cuando estás autenticado.',
    `Cualquier duda: ${salesEmail}`,
    '',
    'Equipo comercial de TCG Iberia',
  ].join('\n');

  await transporter.sendMail({
    from,
    to: params.email,
    replyTo: salesEmail,
    subject: 'TCG Iberia B2B · Tu cuenta ya está activa',
    html: htmlShell('Cuenta B2B activada', content),
    text,
  });
}

/** Optional: sent when an admin disables an account. */
export async function sendB2bAccountDisabledEmail(params: {
  email: string;
  contactName: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const salesEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const content = `
    <tr>
      <td style="padding:32px 32px 16px 32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 12px 0;">Hola ${escapeHtml(params.contactName)},</p>
        <p style="margin:0 0 12px 0;">
          Tu cuenta B2B en TCG Iberia ha sido desactivada temporalmente. Ya no podrás acceder a las tarifas mayoristas hasta que un administrador la reactive.
        </p>
        <p style="margin:0 0 12px 0;">
          Si crees que se trata de un error o quieres obtener más información, escríbenos a
          <a href="mailto:${escapeHtml(salesEmail)}" style="color:${BRAND.primary};text-decoration:none;">${escapeHtml(salesEmail)}</a>.
        </p>
      </td>
    </tr>
  `;

  await transporter.sendMail({
    from,
    to: params.email,
    replyTo: salesEmail,
    subject: 'TCG Iberia B2B · Cuenta desactivada',
    html: htmlShell('Cuenta desactivada', content),
    text: `Hola ${params.contactName}, tu cuenta B2B ha sido desactivada. Para más información: ${salesEmail}.`,
  });
}

/** Optional: sent when an admin re-enables a disabled account. */
export async function sendB2bAccountReactivatedEmail(params: {
  email: string;
  contactName: string;
  loginUrl: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const salesEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const content = `
    <tr>
      <td style="padding:32px 32px 16px 32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 12px 0;">Hola ${escapeHtml(params.contactName)},</p>
        <p style="margin:0 0 12px 0;">
          Tu cuenta B2B en TCG Iberia ya vuelve a estar activa. Puedes iniciar sesión y consultar nuestras tarifas mayoristas cuando quieras.
        </p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 32px 32px 32px;">
        ${primaryButton('Iniciar sesión', params.loginUrl)}
      </td>
    </tr>
  `;

  await transporter.sendMail({
    from,
    to: params.email,
    replyTo: salesEmail,
    subject: 'TCG Iberia B2B · Cuenta reactivada',
    html: htmlShell('Cuenta reactivada', content),
    text: `Hola ${params.contactName}, tu cuenta B2B ya está activa de nuevo. Inicia sesión aquí: ${params.loginUrl}.`,
  });
}

/**
 * Sent to the admin inbox whenever a new B2B request is submitted so the team
 * can begin the review process without polling the admin panel.
 */
export async function sendB2bRequestAdminNotification(email: string): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <sales@tcgiberia.com>';
  const adminEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const content = `
    <tr>
      <td style="padding:32px 32px 16px 32px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 12px 0;">Se ha recibido una nueva solicitud de cuenta B2B:</p>
        <p style="margin:0 0 12px 0;"><strong>Email del solicitante:</strong> ${escapeHtml(email)}</p>
        <p style="margin:0 0 12px 0;">Ya se le ha enviado automáticamente el email pidiéndole la documentación necesaria. Cuando responda, recuerda registrar la información en el panel de administración y aprobar la solicitud.</p>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0 32px 32px 32px;">
        ${primaryButton('Abrir panel B2B', `${appUrl}/admin/b2b`)}
      </td>
    </tr>
  `;

  await transporter.sendMail({
    from,
    to: adminEmail,
    replyTo: email,
    subject: `Nueva solicitud B2B · ${email}`,
    html: htmlShell('Nueva solicitud B2B', content),
    text: `Nueva solicitud B2B recibida.\nEmail: ${email}\nAbre el panel: ${appUrl}/admin/b2b`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// B2B order emails
// ─────────────────────────────────────────────────────────────────────────────

/** Line item used by every order-related email template. */
export interface OrderEmailLine {
  name: string;
  variant?: 'SHRINK' | 'NO_SHRINK';
  quantity: number;
  unitPriceEur: number;
  lineTotal: number;
}

interface OrderContext {
  orderNumber: string;
  customerCompany: string;
  customerEmail: string;
  contactName: string;
  items: OrderEmailLine[];
  subtotal: number;
  ivaAmount: number;
  total: number;
  notes?: string | null;
}

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function orderItemsTable(items: OrderEmailLine[]): string {
  const rows = items
    .map(
      (i) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">
        ${escapeHtml(i.name)}${i.variant === 'NO_SHRINK' ? ' <span style="color:' + BRAND.textMuted + ';">(sin plástico)</span>' : ''}
      </td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">${i.quantity}</td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">${eurFmt.format(i.unitPriceEur)}</td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;font-weight:600;">${eurFmt.format(i.lineTotal)}</td>
    </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th align="left" style="padding:10px 8px;font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${BRAND.text};">Descripción</th>
          <th align="right" style="padding:10px 8px;font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${BRAND.text};">Cant.</th>
          <th align="right" style="padding:10px 8px;font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${BRAND.text};">P. unit.</th>
          <th align="right" style="padding:10px 8px;font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.06em;border-bottom:2px solid ${BRAND.text};">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function orderTotalsBlock(subtotal: number, iva: number, total: number): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 8px;font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};">Base imponible</td>
        <td align="right" style="padding:6px 8px;font-family:${FONT_STACK};font-size:13px;">${eurFmt.format(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};">IVA 21%</td>
        <td align="right" style="padding:6px 8px;font-family:${FONT_STACK};font-size:13px;">${eurFmt.format(iva)}</td>
      </tr>
      <tr>
        <td style="padding:8px 8px;border-top:2px solid ${BRAND.text};font-family:${FONT_STACK};font-size:15px;font-weight:700;">Total</td>
        <td align="right" style="padding:8px 8px;border-top:2px solid ${BRAND.text};font-family:${FONT_STACK};font-size:15px;font-weight:700;color:${BRAND.primary};">${eurFmt.format(total)}</td>
      </tr>
    </table>
  `;
}

/**
 * Sent to the sales inbox (`ADMIN_EMAIL`) whenever a B2B customer submits
 * a new order request. Also delivers a customer confirmation copy.
 */
export async function sendB2bOrderRequestEmail(ctx: OrderContext): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';
  const adminEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const notesBlock = ctx.notes
    ? `<tr><td style="padding:16px 32px;"><div style="padding:12px 14px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};"><strong>Notas del cliente:</strong><br/>${escapeHtml(ctx.notes)}</div></td></tr>`
    : '';

  // ── Sales team email ─────────────────────────────────────────────────
  const adminContent = `
    <tr>
      <td style="padding:24px 32px 8px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 6px 0;">Nuevo pedido mayorista <strong>${escapeHtml(ctx.orderNumber)}</strong>.</p>
        <p style="margin:0 0 12px 0;">Cliente: <strong>${escapeHtml(ctx.customerCompany)}</strong> (${escapeHtml(ctx.customerEmail)}) — Contacto: ${escapeHtml(ctx.contactName)}</p>
      </td>
    </tr>
    <tr><td style="padding:0 32px;">${orderItemsTable(ctx.items)}</td></tr>
    <tr><td style="padding:0 32px;">${orderTotalsBlock(ctx.subtotal, ctx.ivaAmount, ctx.total)}</td></tr>
    ${notesBlock}
    <tr><td style="padding:24px 32px 32px 32px;" align="center">${primaryButton('Revisar pedido', `${appUrl}/admin/b2b`)}</td></tr>
  `;

  const customerContent = `
    <tr>
      <td style="padding:24px 32px 8px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 6px 0;">Hola ${escapeHtml(ctx.contactName)},</p>
        <p style="margin:0 0 12px 0;">Hemos recibido tu pedido <strong>${escapeHtml(ctx.orderNumber)}</strong>. Lo revisaremos y te enviaremos la factura por email en cuanto lo aprobemos.</p>
      </td>
    </tr>
    <tr><td style="padding:0 32px;">${orderItemsTable(ctx.items)}</td></tr>
    <tr><td style="padding:0 32px 32px 32px;">${orderTotalsBlock(ctx.subtotal, ctx.ivaAmount, ctx.total)}</td></tr>
  `;

  await Promise.allSettled([
    transporter.sendMail({
      from,
      to: adminEmail,
      replyTo: ctx.customerEmail,
      subject: `Nuevo pedido B2B ${ctx.orderNumber} · ${ctx.customerCompany}`,
      html: htmlShell(`Pedido B2B ${ctx.orderNumber}`, adminContent),
      text: `Nuevo pedido B2B ${ctx.orderNumber} de ${ctx.customerCompany}. Total ${eurFmt.format(ctx.total)}. Revisa el panel: ${appUrl}/admin/b2b`,
    }),
    transporter.sendMail({
      from,
      to: ctx.customerEmail,
      subject: `Hemos recibido tu pedido ${ctx.orderNumber}`,
      html: htmlShell('Pedido recibido', customerContent),
      text: `Hola ${ctx.contactName}, hemos recibido tu pedido ${ctx.orderNumber}. Te avisaremos por email cuando esté aprobado.`,
    }),
  ]);
}

/**
 * Sent to the B2B customer when the admin accepts the order. Attaches the
 * generated PDF invoice and lists the payment terms.
 */
export async function sendB2bOrderAcceptedEmail(params: {
  ctx: OrderContext;
  invoiceNumber: string;
  invoicePdf: Uint8Array;
  invoiceValidityHours: number;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';

  const content = `
    <tr>
      <td style="padding:24px 32px 8px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 6px 0;">Hola ${escapeHtml(params.ctx.contactName)},</p>
        <p style="margin:0 0 8px 0;">
          Hemos aprobado tu pedido <strong>${escapeHtml(params.ctx.orderNumber)}</strong>.
          Adjuntamos la factura <strong>${escapeHtml(params.invoiceNumber)}</strong> en PDF con los datos para el pago.
        </p>
        <p style="margin:0 0 12px 0;padding:10px 12px;background:${BRAND.primaryLight};border-left:3px solid ${BRAND.primary};border-radius:6px;font-size:13px;">
          El pedido se preparará en cuanto la factura haya sido abonada. La factura es
          válida durante <strong>${params.invoiceValidityHours} horas</strong> debido a
          la variación de precios.
        </p>
      </td>
    </tr>
    <tr><td style="padding:0 32px;">${orderItemsTable(params.ctx.items)}</td></tr>
    <tr><td style="padding:0 32px 32px 32px;">${orderTotalsBlock(params.ctx.subtotal, params.ctx.ivaAmount, params.ctx.total)}</td></tr>
  `;

  await transporter.sendMail({
    from,
    to: params.ctx.customerEmail,
    subject: `Factura ${params.invoiceNumber} — Pedido ${params.ctx.orderNumber}`,
    html: htmlShell(`Pedido aprobado · ${params.invoiceNumber}`, content),
    text: `Tu pedido ${params.ctx.orderNumber} ha sido aprobado. Adjuntamos la factura ${params.invoiceNumber}. Se preparará una vez recibamos el pago. Válida ${params.invoiceValidityHours} horas.`,
    attachments: [
      {
        filename: `${params.invoiceNumber}.pdf`,
        content: Buffer.from(params.invoicePdf),
        contentType: 'application/pdf',
      },
    ],
  });
}

/**
 * Sent to the sales inbox when a customer or admin cancels an order.
 * Used purely for visibility — the state change is already recorded in DB.
 */
export async function sendB2bOrderCancelledEmail(params: {
  orderNumber: string;
  customerCompany: string;
  customerEmail: string;
  cancelledBy: 'customer' | 'admin';
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;
  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';
  const adminEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const content = `
    <tr>
      <td style="padding:24px 32px;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
        <p style="margin:0 0 6px 0;">Pedido <strong>${escapeHtml(params.orderNumber)}</strong> cancelado.</p>
        <p style="margin:0 0 6px 0;">Cliente: <strong>${escapeHtml(params.customerCompany)}</strong> (${escapeHtml(params.customerEmail)})</p>
        <p style="margin:0;">Cancelado por: <strong>${params.cancelledBy === 'customer' ? 'el cliente' : 'un administrador'}</strong>.</p>
      </td>
    </tr>
  `;

  await transporter.sendMail({
    from,
    to: adminEmail,
    subject: `Pedido B2B cancelado · ${params.orderNumber}`,
    html: htmlShell('Pedido cancelado', content),
    text: `El pedido ${params.orderNumber} de ${params.customerCompany} ha sido cancelado por ${params.cancelledBy === 'customer' ? 'el cliente' : 'un administrador'}.`,
  });
}
