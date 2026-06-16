import * as nodemailer from 'nodemailer';

/**
 * Email service for order notifications.
 *
 * Required env vars (all SMTP-compatible providers — Gmail, Resend, Brevo,
 * SendGrid, custom servers, etc.):
 *   - SMTP_HOST          e.g. smtp.resend.com
 *   - SMTP_PORT          e.g. 465 (SSL) or 587 (STARTTLS)
 *   - SMTP_USER
 *   - SMTP_PASSWORD
 *   - SMTP_FROM          e.g. "TCG Iberia <sales@tcgiberia.com>"
 *   - ADMIN_EMAIL        defaults to sales@tcgiberia.com
 */

export interface OrderEmailItem {
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number | null;
}

export interface OrderEmailPayload {
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  totalAmount: number;
  items: OrderEmailItem[];
  paymentStatus: string; // 'paid' | 'unpaid' | 'no_payment_required' (Stripe values)
  shipping?: {
    address?: string;
    postalCode?: string;
    city?: string;
    locality?: string;
    province?: string;
  };
}

export interface StockAlertEmailPayload {
  to: string;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    price: number;
    discountPercentage?: number | null;
  };
}

export interface CartRecoveryItem {
  name: string;
  quantity: number;
  price: number;
  discountPercentage?: number | null;
  imageUrl?: string | null;
}

export interface CartRecoveryEmailPayload {
  to: string;
  firstName?: string;
  items: CartRecoveryItem[];
  totalAmount: number;
  recoveryUrl: string;
}

// --- Branding ---
const BRAND = {
  primary: '#DC2626', // red-500 from tailwind.config.ts
  primaryDark: '#B91C1C',
  primaryLight: '#FEF2F2',
  text: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
};

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif";

// Gracefully reuse the transporter across requests (Next.js may hot-reload).
type Cached = { transporter: nodemailer.Transporter | null };
const globalForMailer = global as unknown as { _tcgMailer?: Cached };
if (!globalForMailer._tcgMailer) {
  globalForMailer._tcgMailer = { transporter: null };
}

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
      '[email] SMTP env vars missing — emails will not be sent. ' +
        'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.'
    );
    return null;
  }

  const portNumber = Number(port);
  const transporter = nodemailer.createTransport({
    host,
    port: portNumber,
    secure: portNumber === 465, // 465 = implicit TLS
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

function lineSubtotal(item: OrderEmailItem): number {
  const discount = item.discountPercentage ?? 0;
  const unit = item.price * (1 - discount / 100);
  return unit * item.quantity;
}

function paymentStatusBadge(status: string): {
  label: string;
  bg: string;
  fg: string;
} {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'paid') {
    return { label: 'PAGADO', bg: '#DCFCE7', fg: BRAND.success };
  }
  if (normalized === 'unpaid' || normalized === 'failed') {
    return { label: 'NO PAGADO', bg: '#FEE2E2', fg: BRAND.danger };
  }
  return { label: 'PENDIENTE', bg: '#FEF3C7', fg: BRAND.warning };
}

// --- HTML building blocks ---

function htmlShell(title: string, contentHtml: string): string {
  // Inline styles only — most email clients strip <style>/<link>.
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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%);padding:32px 32px 28px 32px;text-align:left;">
              <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.18em;color:rgba(255,255,255,0.85);text-transform:uppercase;font-weight:600;">TCG Iberia</div>
              <div style="font-family:${FONT_STACK};font-size:24px;font-weight:700;color:${BRAND.white};margin-top:8px;line-height:1.2;">${escapeHtml(title)}</div>
            </td>
          </tr>
          ${contentHtml}
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid ${BRAND.border};background:${BRAND.bg};">
              <div style="font-family:${FONT_STACK};font-size:12px;color:${BRAND.textMuted};line-height:1.6;text-align:center;">
                &copy; ${new Date().getFullYear()} TCG Iberia &middot; Tienda Premium de Cartas TCG/Pok&eacute;mon<br/>
                Este correo se ha enviado autom&aacute;ticamente, no responda a esta direcci&oacute;n.
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

function itemsTableHtml(items: OrderEmailItem[]): string {
  const rows = items
    .map((item, i) => {
      const subtotal = lineSubtotal(item);
      const isLast = i === items.length - 1;
      const borderStyle = isLast ? '' : `border-bottom:1px solid ${BRAND.border};`;
      const discountBadge =
        item.discountPercentage && item.discountPercentage > 0
          ? `<div style="display:inline-block;margin-top:4px;padding:2px 8px;background:${BRAND.primaryLight};color:${BRAND.primary};border-radius:999px;font-size:11px;font-weight:600;">-${escapeHtml(item.discountPercentage)}%</div>`
          : '';
      return `
        <tr>
          <td style="padding:16px 0;${borderStyle}font-family:${FONT_STACK};">
            <div style="font-size:14px;font-weight:600;color:${BRAND.text};line-height:1.3;">${escapeHtml(item.name)}</div>
            <div style="font-size:12px;color:${BRAND.textMuted};margin-top:4px;">${escapeHtml(item.quantity)} &times; ${formatCurrency(item.price)}</div>
            ${discountBadge}
          </td>
          <td align="right" style="padding:16px 0;${borderStyle}font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${BRAND.text};white-space:nowrap;">${formatCurrency(subtotal)}</td>
        </tr>`;
    })
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      ${rows}
    </table>
  `;
}

function totalRowHtml(total: number): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:2px solid ${BRAND.text};">
      <tr>
        <td style="padding-top:16px;font-family:${FONT_STACK};font-size:14px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Total</td>
        <td align="right" style="padding-top:16px;font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${BRAND.primary};">${formatCurrency(total)}</td>
      </tr>
    </table>
  `;
}

// --- Customer email ---

function buildCustomerHtml(payload: OrderEmailPayload): string {
  const firstName = payload.fullName.split(' ')[0] || payload.fullName;

  const content = `
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:${BRAND.text};">
          Hola <strong>${escapeHtml(firstName)}</strong>,
        </p>
        <p style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          &iexcl;Gracias por tu pedido en TCG Iberia! Hemos recibido correctamente tu compra y la estamos preparando con todo el cuidado para que llegue a tus manos cuanto antes.
        </p>

        <!-- Order number card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr>
            <td style="padding:16px 20px;background:${BRAND.primaryLight};border-left:4px solid ${BRAND.primary};border-radius:8px;">
              <div style="font-family:${FONT_STACK};font-size:11px;letter-spacing:0.12em;color:${BRAND.primary};text-transform:uppercase;font-weight:700;">N&uacute;mero de pedido</div>
              <div style="font-family:${FONT_STACK};font-size:18px;font-weight:700;color:${BRAND.text};margin-top:4px;letter-spacing:0.02em;">${escapeHtml(payload.orderNumber)}</div>
            </td>
          </tr>
        </table>

        <!-- Items header -->
        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Resumen del pedido</div>
        ${itemsTableHtml(payload.items)}
        ${totalRowHtml(payload.totalAmount)}

        <p style="margin:32px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.textMuted};">
          Te enviaremos otro correo en cuanto tu pedido salga de nuestro almac&eacute;n. Si tienes cualquier duda, escr&iacute;benos a
          <a href="mailto:sales@tcgiberia.com" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">sales@tcgiberia.com</a>.
        </p>
        <p style="margin:24px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
          &iexcl;Que disfrutes de tus cartas! 🎉<br/>
          <strong>El equipo de TCG Iberia</strong>
        </p>
      </td>
    </tr>
  `;

  return htmlShell('Confirmaci\u00f3n de tu pedido', content);
}

// --- Admin email ---

function buildAdminHtml(payload: OrderEmailPayload): string {
  const badge = paymentStatusBadge(payload.paymentStatus);
  const shipping = payload.shipping;
  const shippingBlock = shipping
    ? `
      <tr>
        <td style="padding:16px 20px;background:${BRAND.bg};border-radius:8px;font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};line-height:1.6;">
          <div style="font-size:11px;letter-spacing:0.12em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:700;margin-bottom:6px;">Direcci&oacute;n de env&iacute;o</div>
          ${escapeHtml(shipping.address || '')}<br/>
          ${escapeHtml(shipping.postalCode || '')} ${escapeHtml(shipping.city || '')}<br/>
          ${escapeHtml(shipping.locality || '')}${shipping.locality && shipping.province ? ', ' : ''}${escapeHtml(shipping.province || '')}
        </td>
      </tr>`
    : '';

  const content = `
    <tr>
      <td style="padding:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr>
            <td style="font-family:${FONT_STACK};font-size:14px;color:${BRAND.text};">
              <strong>Nuevo pedido recibido</strong>
              <div style="font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};margin-top:4px;">${escapeHtml(payload.orderNumber)}</div>
            </td>
            <td align="right">
              <span style="display:inline-block;padding:6px 14px;background:${badge.bg};color:${badge.fg};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border-radius:999px;">${escapeHtml(badge.label)}</span>
            </td>
          </tr>
        </table>

        <!-- Customer info card -->
        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 8px 0;">Cliente</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:14px 20px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">
              <span style="color:${BRAND.textMuted};display:inline-block;width:90px;">Nombre</span>
              <strong style="color:${BRAND.text};">${escapeHtml(payload.fullName)}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">
              <span style="color:${BRAND.textMuted};display:inline-block;width:90px;">Email</span>
              <a href="mailto:${escapeHtml(payload.email)}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${escapeHtml(payload.email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 20px;font-family:${FONT_STACK};font-size:13px;">
              <span style="color:${BRAND.textMuted};display:inline-block;width:90px;">Tel&eacute;fono</span>
              <a href="tel:${escapeHtml(payload.phone)}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${escapeHtml(payload.phone)}</a>
            </td>
          </tr>
          ${shippingBlock}
        </table>

        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Art&iacute;culos</div>
        ${itemsTableHtml(payload.items)}
        ${totalRowHtml(payload.totalAmount)}
      </td>
    </tr>
  `;

  return htmlShell('Nuevo pedido recibido', content);
}

// --- Plain text fallbacks ---

function buildCustomerText(payload: OrderEmailPayload): string {
  const lines = payload.items.map(
    (i) => `  - ${i.name}  x${i.quantity}  ${formatCurrency(lineSubtotal(i))}`
  );
  return [
    `Hola ${payload.fullName},`,
    '',
    'Gracias por tu pedido en TCG Iberia. Hemos recibido tu compra correctamente.',
    '',
    `Numero de pedido: ${payload.orderNumber}`,
    '',
    'Resumen:',
    ...lines,
    '',
    `Total: ${formatCurrency(payload.totalAmount)}`,
    '',
    'El equipo de TCG Iberia',
  ].join('\n');
}

function buildAdminText(payload: OrderEmailPayload): string {
  const lines = payload.items.map(
    (i) => `  - ${i.name}  x${i.quantity}  ${formatCurrency(lineSubtotal(i))}`
  );
  return [
    `Nuevo pedido: ${payload.orderNumber}`,
    `Estado pago: ${payload.paymentStatus}`,
    '',
    `Cliente: ${payload.fullName}`,
    `Email:   ${payload.email}`,
    `Telefono:${payload.phone}`,
    '',
    'Articulos:',
    ...lines,
    '',
    `Total: ${formatCurrency(payload.totalAmount)}`,
  ].join('\n');
}

function buildStockAlertHtml(payload: StockAlertEmailPayload): string {
  const finalPrice = payload.product.discountPercentage
    ? payload.product.price * (1 - payload.product.discountPercentage / 100)
    : payload.product.price;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const productUrl = `${appUrl}/product/${payload.product.slug}`;

  const imageBlock = payload.product.imageUrl
    ? `
      <tr>
        <td style="padding:0 32px 0 32px;">
          <img src="${escapeHtml(payload.product.imageUrl)}" alt="${escapeHtml(payload.product.name)}" style="display:block;width:100%;max-width:220px;height:auto;margin:0 auto;border-radius:12px;border:1px solid ${BRAND.border};background:${BRAND.bg};" />
        </td>
      </tr>
      <tr><td style="height:20px;"></td></tr>`
    : '';

  const discountBlock = payload.product.discountPercentage
    ? `
      <div style="margin-top:6px;font-size:13px;color:${BRAND.textMuted};">
        Antes: <span style="text-decoration:line-through;">${formatCurrency(payload.product.price)}</span>
        <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:${BRAND.primaryLight};color:${BRAND.primary};border-radius:999px;font-weight:600;">-${escapeHtml(payload.product.discountPercentage)}%</span>
      </div>`
    : '';

  const content = `
    <tr>
      <td style="padding:32px 32px 20px 32px;">
        <p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:${BRAND.text};">
          ¡Buenas noticias!
        </p>
        <p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          El producto que estabas esperando ya vuelve a estar en stock.
        </p>
      </td>
    </tr>
    ${imageBlock}
    <tr>
      <td style="padding:0 32px 0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:16px 18px;background:${BRAND.white};">
              <div style="font-family:${FONT_STACK};font-size:18px;font-weight:700;color:${BRAND.text};line-height:1.3;">${escapeHtml(payload.product.name)}</div>
              <div style="margin-top:8px;font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${BRAND.primary};">${formatCurrency(finalPrice)}</div>
              ${discountBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>
    <tr>
      <td align="center" style="padding:0 32px 32px 32px;">
        <a href="${escapeHtml(productUrl)}" style="display:inline-block;padding:12px 22px;background:${BRAND.primary};color:${BRAND.white};font-family:${FONT_STACK};font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;">Ver producto</a>
      </td>
    </tr>
  `;

  return htmlShell('¡Tu producto vuelve a estar disponible!', content);
}

function buildStockAlertText(payload: StockAlertEmailPayload): string {
  const finalPrice = payload.product.discountPercentage
    ? payload.product.price * (1 - payload.product.discountPercentage / 100)
    : payload.product.price;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const productUrl = `${appUrl}/product/${payload.product.slug}`;

  return [
    '¡Tu producto vuelve a estar disponible!',
    '',
    'El producto que estabas esperando ya vuelve a estar en stock.',
    '',
    `Producto: ${payload.product.name}`,
    `Precio: ${formatCurrency(finalPrice)}`,
    `Enlace: ${productUrl}`,
    '',
    'TCG Iberia',
  ].join('\n');
}

// --- Cart Recovery email ---

function cartRecoveryItemsTableHtml(items: CartRecoveryItem[]): string {
  const rows = items
    .map((item, i) => {
      const discount = item.discountPercentage ?? 0;
      const unit = item.price * (1 - discount / 100);
      const subtotal = unit * item.quantity;
      const isLast = i === items.length - 1;
      const border = isLast ? '' : `border-bottom:1px solid ${BRAND.border};`;

      const imageBlock = item.imageUrl
        ? `<td style="padding:12px 12px 12px 0;${border}width:64px;vertical-align:top;">
             <img src="${escapeHtml(item.imageUrl)}" alt="" style="width:56px;height:56px;object-fit:contain;border-radius:8px;background:${BRAND.bg};border:1px solid ${BRAND.border};" />
           </td>`
        : '';

      const discountBadge =
        discount > 0
          ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;background:${BRAND.primaryLight};color:${BRAND.primary};border-radius:999px;font-size:11px;font-weight:600;">-${escapeHtml(discount)}%</span>`
          : '';

      return `<tr>
        ${imageBlock}
        <td style="padding:12px 0;${border}font-family:${FONT_STACK};vertical-align:top;">
          <div style="font-size:14px;font-weight:600;color:${BRAND.text};line-height:1.3;">${escapeHtml(item.name)}${discountBadge}</div>
          <div style="font-size:12px;color:${BRAND.textMuted};margin-top:4px;">${escapeHtml(item.quantity)} &times; ${formatCurrency(unit)}</div>
        </td>
        <td align="right" style="padding:12px 0;${border}font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${BRAND.text};white-space:nowrap;vertical-align:top;">${formatCurrency(subtotal)}</td>
      </tr>`;
    })
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">${rows}</table>`;
}

function buildCartRecoveryHtml(payload: CartRecoveryEmailPayload): string {
  const greeting = payload.firstName
    ? `Hola <strong>${escapeHtml(payload.firstName)}</strong>,`
    : 'Hola,';

  const content = `
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 8px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.5;color:${BRAND.text};">
          ${greeting}
        </p>
        <p style="margin:0 0 24px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.6;color:${BRAND.text};">
          Los productos que seleccionaste siguen esperándote. ¿Nos faltó algo?
        </p>

        <!-- Items -->
        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Tu carrito</div>
        ${cartRecoveryItemsTableHtml(payload.items)}
        ${totalRowHtml(payload.totalAmount)}

        <!-- CTA -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
          <tr>
            <td align="center">
              <a href="${escapeHtml(payload.recoveryUrl)}"
                 style="display:inline-block;padding:14px 32px;background:${BRAND.primary};color:${BRAND.white};font-family:${FONT_STACK};font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
                Finalizar compra
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:28px 0 0 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.textMuted};text-align:center;">
          Si el botón no funciona, copia este enlace en tu navegador:<br/>
          <a href="${escapeHtml(payload.recoveryUrl)}" style="color:${BRAND.primary};word-break:break-all;">${escapeHtml(payload.recoveryUrl)}</a>
        </p>
        <p style="margin:24px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.text};">
          Un saludo,<br/>
          <strong>El equipo de TCG Iberia</strong>
        </p>
      </td>
    </tr>
  `;

  return htmlShell('Has olvidado algunos productos en tu carrito', content);
}

function buildCartRecoveryText(payload: CartRecoveryEmailPayload): string {
  const lines = payload.items.map((item) => {
    const unit = item.price * (1 - (item.discountPercentage ?? 0) / 100);
    return `  - ${item.name}  x${item.quantity}  ${formatCurrency(unit * item.quantity)}`;
  });
  return [
    payload.firstName ? `Hola ${payload.firstName},` : 'Hola,',
    '',
    'Los productos que seleccionaste siguen esperándote.',
    '',
    'Tu carrito:',
    ...lines,
    '',
    `Total: ${formatCurrency(payload.totalAmount)}`,
    '',
    `Finalizar compra: ${payload.recoveryUrl}`,
    '',
    'El equipo de TCG Iberia',
  ].join('\n');
}

// --- Public API ---

export async function sendOrderEmails(payload: OrderEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';
  const adminEmail = process.env.ADMIN_EMAIL || 'sales@tcgiberia.com';

  const customerSubject = `Tu pedido ${payload.orderNumber} - TCG Iberia`;
  const adminSubject = `Nuevo pedido ${payload.orderNumber} - ${payload.fullName}`;

  const tasks: Promise<unknown>[] = [
    transporter.sendMail({
      from,
      to: payload.email,
      subject: customerSubject,
      html: buildCustomerHtml(payload),
      text: buildCustomerText(payload),
    }),
    transporter.sendMail({
      from,
      to: adminEmail,
      replyTo: payload.email,
      subject: adminSubject,
      html: buildAdminHtml(payload),
      text: buildAdminText(payload),
    }),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[email] ${i === 0 ? 'customer' : 'admin'} send failed`, r.reason);
    }
  });
}

export async function sendCartRecoveryEmail(payload: CartRecoveryEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: 'Has olvidado algunos productos en tu carrito',
    html: buildCartRecoveryHtml(payload),
    text: buildCartRecoveryText(payload),
  });
}

export async function sendStockAlertEmail(payload: StockAlertEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) return;

  const from = process.env.SMTP_FROM || 'TCG Iberia <noreply@tcgiberia.com>';

  await transporter.sendMail({
    from,
    to: payload.to,
    subject: '¡Tu producto vuelve a estar disponible!',
    html: buildStockAlertHtml(payload),
    text: buildStockAlertText(payload),
  });
}
