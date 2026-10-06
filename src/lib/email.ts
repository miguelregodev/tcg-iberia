import * as nodemailer from 'nodemailer';
import { ORDER_ITEM_VARIANT_LABEL, type OrderItemVariant } from '@/lib/orders/items';

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
  variant?: OrderItemVariant;
}

export interface OrderEmailPayload {
  orderNumber: string;
  fullName: string;
  email: string;
  phone: string;
  totalAmount: number;
  items: OrderEmailItem[];
  paymentStatus: string; // 'paid' | 'unpaid' | 'no_payment_required' (Stripe values)
  shippingCost?: number; // Calculated shipping cost; if not provided, will be computed
  /** "Agrupar Envío" orders defer shipment (and its fee) until the customer requests it. Defaults to IMMEDIATE. */
  shippingMode?: 'IMMEDIATE' | 'GROUPED';
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

export interface ShipmentRequestEmailPayload {
  shipmentNumber: string;
  fullName: string;
  email: string;
  phone: string;
  shipping: {
    address: string;
    postalCode: string;
    city: string;
    locality: string;
    province: string;
  };
  merchandiseTotal: number;
  shippingCost: number;
  requiresPayment: boolean;
  orders: Array<{
    orderNumber: string;
    totalAmount: number;
    items: OrderEmailItem[];
  }>;
}

export interface ShippingNotificationPayload {
  orderNumber: string;
  fullName: string;
  email: string;
  shippingProvider: string;
  trackingNumber: string;
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

// Strips accidental wrapping quotes from env values (Vercel dashboard doesn't
// strip them like dotenv does), which otherwise breaks the SMTP MAIL FROM command.
function getFromAddress(fallback: string): string {
  const raw = process.env.SMTP_FROM || fallback;
  return raw.trim().replace(/^["']+|["']+$/g, '');
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
    const missingVars = [
      !host && 'SMTP_HOST',
      !port && 'SMTP_PORT',
      !user && 'SMTP_USER',
      !pass && 'SMTP_PASSWORD',
    ]
      .filter(Boolean)
      .join(', ');

    console.error(
      `[email] CRITICAL: Missing SMTP configuration. Emails will not be sent.\n` +
      `Missing variables: ${missingVars}\n` +
      `Please set these in your .env.local or deployment environment.\n` +
      `See EMAIL_CONFIGURATION.md for setup instructions.`
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

function textItemName(item: OrderEmailItem): string {
  return item.variant ? `${item.name} [${ORDER_ITEM_VARIANT_LABEL[item.variant]}]` : item.name;
}

function calculateSubtotal(items: OrderEmailItem[]): number {
  return items.reduce((sum, item) => sum + lineSubtotal(item), 0);
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
      const variantBadge = item.variant
        ? `<div style="display:inline-block;margin-top:4px;margin-right:6px;padding:2px 8px;background:${item.variant === 'live' ? BRAND.primaryLight : BRAND.bg};color:${item.variant === 'live' ? BRAND.primary : BRAND.textMuted};border:1px solid ${BRAND.border};border-radius:999px;font-size:11px;font-weight:600;">${escapeHtml(ORDER_ITEM_VARIANT_LABEL[item.variant])}</div>`
        : '';
      return `
        <tr>
          <td style="padding:16px 0;${borderStyle}font-family:${FONT_STACK};">
            <div style="font-size:14px;font-weight:600;color:${BRAND.text};line-height:1.3;">${escapeHtml(item.name)}</div>
            <div style="font-size:12px;color:${BRAND.textMuted};margin-top:4px;">${escapeHtml(item.quantity)} &times; ${formatCurrency(item.price)}</div>
            ${variantBadge}${discountBadge}
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

function totalBreakdownHtml(
  subtotal: number,
  shippingCost: number,
  total: number,
  shippingLabel?: string,
): string {
  const shippingDisplay = shippingLabel ?? (shippingCost === 0 ? 'Gratis' : formatCurrency(shippingCost));
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
      <tr>
        <td style="padding:8px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};">Subtotal</td>
        <td align="right" style="padding:8px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};font-weight:500;">${formatCurrency(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};">Env&iacute;o</td>
        <td align="right" style="padding:8px 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};font-weight:500;">${shippingDisplay}</td>
      </tr>
      <tr>
        <td style="padding-top:12px;border-top:2px solid ${BRAND.text};font-family:${FONT_STACK};font-size:14px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Total</td>
        <td align="right" style="padding-top:12px;border-top:2px solid ${BRAND.text};font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${BRAND.primary};">${formatCurrency(total)}</td>
      </tr>
    </table>
  `;
}

// --- Customer email ---

function isGrouped(payload: OrderEmailPayload): boolean {
  return payload.shippingMode === 'GROUPED';
}

function shippingModeLabel(payload: OrderEmailPayload): string {
  return isGrouped(payload) ? 'Envío agrupado' : 'Envío normal';
}

function shippingModeCardHtml(payload: OrderEmailPayload, audience: 'customer' | 'admin'): string {
  const grouped = isGrouped(payload);
  const description =
    audience === 'admin'
      ? grouped
        ? 'No enviar todav&iacute;a: el cliente solicitar&aacute; el env&iacute;o m&aacute;s adelante y abonar&aacute; una &uacute;nica tarifa de env&iacute;o.'
        : 'Preparar y enviar este pedido de inmediato.'
      : grouped
        ? 'Guardaremos tu pedido hasta que solicites el env&iacute;o desde Mi cuenta &rarr; Pedidos. Podr&aacute;s combinar varios pedidos y pagar el env&iacute;o una sola vez.'
        : 'Prepararemos y enviaremos tu pedido en cuanto sea posible.';
  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr>
            <td style="padding:16px 20px;background:${grouped ? BRAND.primaryLight : BRAND.bg};border-left:4px solid ${grouped ? BRAND.primary : BRAND.border};border-radius:8px;font-family:${FONT_STACK};">
              <div style="font-size:11px;letter-spacing:0.12em;color:${grouped ? BRAND.primary : BRAND.textMuted};text-transform:uppercase;font-weight:700;">Tipo de env&iacute;o</div>
              <div style="font-size:16px;font-weight:700;color:${BRAND.text};margin-top:4px;">${escapeHtml(shippingModeLabel(payload))}</div>
              <div style="font-size:13px;color:${BRAND.textMuted};margin-top:6px;line-height:1.5;">${description}</div>
            </td>
          </tr>
        </table>`;
}

function shippingLabelFor(payload: OrderEmailPayload): string | undefined {
  return isGrouped(payload) ? 'Pendiente de solicitar' : undefined;
}

function buildCustomerHtml(payload: OrderEmailPayload): string {
  const firstName = payload.fullName.split(' ')[0] || payload.fullName;
  
  // Calculate shipping cost if not provided
  const subtotal = calculateSubtotal(payload.items);
  const shippingCost = payload.shippingCost ?? Math.round((payload.totalAmount - subtotal) * 100) / 100;

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

        ${shippingModeCardHtml(payload, 'customer')}

        <!-- Items header -->
        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Resumen del pedido</div>
        ${itemsTableHtml(payload.items)}
        ${totalBreakdownHtml(subtotal, shippingCost, payload.totalAmount, shippingLabelFor(payload))}

        <p style="margin:32px 0 0 0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${BRAND.textMuted};">
          ${isGrouped(payload) ? 'Te avisaremos cuando solicites y salga tu env&iacute;o.' : 'Te enviaremos otro correo en cuanto tu pedido salga de nuestro almac&eacute;n.'} Si tienes cualquier duda, escr&iacute;benos a
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
  
  // Calculate shipping cost if not provided
  const subtotal = calculateSubtotal(payload.items);
  const shippingCost = payload.shippingCost ?? Math.round((payload.totalAmount - subtotal) * 100) / 100;
  
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

        ${shippingModeCardHtml(payload, 'admin')}

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
        ${totalBreakdownHtml(subtotal, shippingCost, payload.totalAmount, shippingLabelFor(payload))}
      </td>
    </tr>
  `;

  return htmlShell('Nuevo pedido recibido', content);
}

// --- Plain text fallbacks ---

function buildCustomerText(payload: OrderEmailPayload): string {
  const lines = payload.items.map(
    (i) => `  - ${textItemName(i)}  x${i.quantity}  ${formatCurrency(lineSubtotal(i))}`
  );
  
  const subtotal = calculateSubtotal(payload.items);
  const shippingCost = payload.shippingCost ?? Math.round((payload.totalAmount - subtotal) * 100) / 100;
  const shippingDisplay = isGrouped(payload) ? 'Pendiente de solicitar' : shippingCost === 0 ? 'Gratis' : formatCurrency(shippingCost);
  
  return [
    `Hola ${payload.fullName},`,
    '',
    'Gracias por tu pedido en TCG Iberia. Hemos recibido tu compra correctamente.',
    '',
    `Numero de pedido: ${payload.orderNumber}`,
    `Tipo de envio:    ${shippingModeLabel(payload)}`,
    '',
    'Resumen:',
    ...lines,
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Envio:    ${shippingDisplay}`,
    `Total:    ${formatCurrency(payload.totalAmount)}`,
    '',
    'El equipo de TCG Iberia',
  ].join('\n');
}

function buildAdminText(payload: OrderEmailPayload): string {
  const lines = payload.items.map(
    (i) => `  - ${textItemName(i)}  x${i.quantity}  ${formatCurrency(lineSubtotal(i))}`
  );
  
  const subtotal = calculateSubtotal(payload.items);
  const shippingCost = payload.shippingCost ?? Math.round((payload.totalAmount - subtotal) * 100) / 100;
  const shippingDisplay = isGrouped(payload) ? 'Pendiente de solicitar' : shippingCost === 0 ? 'Gratis' : formatCurrency(shippingCost);
  
  return [
    `Nuevo pedido: ${payload.orderNumber}`,
    `Estado pago: ${payload.paymentStatus}`,
    `Tipo de envio: ${shippingModeLabel(payload)}`,
    '',
    `Cliente: ${payload.fullName}`,
    `Email:   ${payload.email}`,
    `Telefono:${payload.phone}`,
    '',
    'Articulos:',
    ...lines,
    '',
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Envio:    ${shippingDisplay}`,
    `Total:    ${formatCurrency(payload.totalAmount)}`,
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

// --- Public API ---

export async function sendOrderEmails(payload: OrderEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      `[email] Cannot send order emails for ${payload.orderNumber}: ` +
      `SMTP not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment.`
    );
    return;
  }

  const from = getFromAddress('TCG Iberia <noreply@tcgiberia.com>');
  const adminEmail = (process.env.ADMIN_EMAIL || 'sales@tcgiberia.com').trim().toLowerCase();
  const customerEmail = (payload.email || '').trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail) || !emailRegex.test(adminEmail)) {
    console.error(
      `[email] Invalid email format for order ${payload.orderNumber}\n` +
      `  → Customer: ${customerEmail}\n` +
      `  → Admin: ${adminEmail}`
    );
    return;
  }

  const customerSubject = `Pedido Confirmado ${payload.orderNumber} - TCG Iberia`;
  const adminSubject = `Nuevo pedido ${payload.orderNumber}`;

  console.log(
    `[email] Sending order confirmation emails for order ${payload.orderNumber}\n` +
    `  → Customer: ${customerEmail}\n` +
    `  → Admin: ${adminEmail}`
  );

  const tasks: Promise<unknown>[] = [
    transporter.sendMail({
      from,
      to: customerEmail,
      subject: customerSubject,
      html: buildCustomerHtml(payload),
      text: buildCustomerText(payload),
    }),
    transporter.sendMail({
      from,
      to: adminEmail,
      replyTo: customerEmail,
      subject: adminSubject,
      html: buildAdminHtml(payload),
      text: buildAdminText(payload),
    }),
  ];

  const results = await Promise.allSettled(tasks);
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const emailType = i === 0 ? 'customer' : 'admin';
      const recipient = i === 0 ? customerEmail : adminEmail;
      console.error(
        `[email] Failed to send ${emailType} email to ${recipient}\n` +
        `Order: ${payload.orderNumber}\n` +
        `Error: ${String(r.reason)}`
      );
    } else {
      const emailType = i === 0 ? 'customer' : 'admin';
      const recipient = i === 0 ? customerEmail : adminEmail;
      console.log(`[email] ✓ ${emailType} email sent to ${recipient}`);
    }
  });
}

// --- Shipment request (admin) email ---

function buildShipmentRequestAdminHtml(payload: ShipmentRequestEmailPayload): string {
  const statusBadge = payload.requiresPayment
    ? { label: 'PAGO PENDIENTE', bg: '#FEF3C7', fg: BRAND.warning }
    : { label: 'ENV\u00cdO GRATIS', bg: '#DCFCE7', fg: BRAND.success };

  const ordersBlock = payload.orders
    .map(
      (order) => `
        <div style="font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};font-weight:700;margin:20px 0 4px 0;">Pedido ${escapeHtml(order.orderNumber)} &middot; ${formatCurrency(order.totalAmount)}</div>
        ${itemsTableHtml(order.items)}
      `
    )
    .join('');

  const content = `
    <tr>
      <td style="padding:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          <tr>
            <td style="font-family:${FONT_STACK};font-size:14px;color:${BRAND.text};">
              <strong>Solicitud de env&iacute;o agrupado</strong>
              <div style="font-family:${FONT_STACK};font-size:13px;color:${BRAND.textMuted};margin-top:4px;">${escapeHtml(payload.shipmentNumber)}</div>
            </td>
            <td align="right">
              <span style="display:inline-block;padding:6px 14px;background:${statusBadge.bg};color:${statusBadge.fg};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;border-radius:999px;">${escapeHtml(statusBadge.label)}</span>
            </td>
          </tr>
        </table>

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
            <td style="padding:14px 20px;border-bottom:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;">
              <span style="color:${BRAND.textMuted};display:inline-block;width:90px;">Tel&eacute;fono</span>
              <a href="tel:${escapeHtml(payload.phone)}" style="color:${BRAND.primary};text-decoration:none;font-weight:600;">${escapeHtml(payload.phone)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 20px;background:${BRAND.bg};font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};line-height:1.6;">
              <div style="font-size:11px;letter-spacing:0.12em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:700;margin-bottom:6px;">Direcci&oacute;n de env&iacute;o</div>
              ${escapeHtml(payload.shipping.address)}<br/>
              ${escapeHtml(payload.shipping.postalCode)} ${escapeHtml(payload.shipping.city)}<br/>
              ${escapeHtml(payload.shipping.locality)}${payload.shipping.locality && payload.shipping.province ? ', ' : ''}${escapeHtml(payload.shipping.province)}
            </td>
          </tr>
        </table>

        <div style="font-family:${FONT_STACK};font-size:13px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:600;margin:0 0 4px 0;">Pedidos a enviar (${payload.orders.length})</div>
        ${ordersBlock}
        ${totalBreakdownHtml(payload.merchandiseTotal, payload.shippingCost, payload.merchandiseTotal + payload.shippingCost)}
      </td>
    </tr>
  `;

  return htmlShell('Solicitud de env\u00edo agrupado', content);
}

function buildShipmentRequestAdminText(payload: ShipmentRequestEmailPayload): string {
  const orderLines = payload.orders.flatMap((order) => [
    `Pedido ${order.orderNumber} (${formatCurrency(order.totalAmount)}):`,
    ...order.items.map((i) => `  - ${textItemName(i)}  x${i.quantity}  ${formatCurrency(lineSubtotal(i))}`),
  ]);

  return [
    `Solicitud de envio agrupado: ${payload.shipmentNumber}`,
    `Estado: ${payload.requiresPayment ? 'Pago pendiente' : 'Envio gratis'}`,
    '',
    `Cliente: ${payload.fullName}`,
    `Email:   ${payload.email}`,
    `Telefono:${payload.phone}`,
    '',
    'Direccion de envio:',
    `  ${payload.shipping.address}`,
    `  ${payload.shipping.postalCode} ${payload.shipping.city}`,
    `  ${payload.shipping.locality}${payload.shipping.locality && payload.shipping.province ? ', ' : ''}${payload.shipping.province}`,
    '',
    `Pedidos a enviar (${payload.orders.length}):`,
    ...orderLines,
    '',
    `Mercancia: ${formatCurrency(payload.merchandiseTotal)}`,
    `Envio:     ${formatCurrency(payload.shippingCost)}`,
  ].join('\n');
}

/** Notifies the sales inbox whenever a customer requests a grouped shipment, so the
 * team can verify the consolidated order/product list before preparing the package. */
export async function sendShipmentRequestAdminNotification(payload: ShipmentRequestEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      `[email] Cannot send shipment request notification for ${payload.shipmentNumber}: ` +
      `SMTP not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment.`
    );
    return;
  }

  const from = getFromAddress('TCG Iberia <noreply@tcgiberia.com>');
  const adminEmail = (process.env.ADMIN_EMAIL || 'sales@tcgiberia.com').trim().toLowerCase();

  try {
    await transporter.sendMail({
      from,
      to: adminEmail,
      replyTo: payload.email,
      subject: `Solicitud de env\u00edo agrupado ${payload.shipmentNumber} - ${payload.fullName}`,
      html: buildShipmentRequestAdminHtml(payload),
      text: buildShipmentRequestAdminText(payload),
    });
    console.log(`[email] \u2713 Shipment request notification sent to ${adminEmail} for ${payload.shipmentNumber}`);
  } catch (error) {
    console.error(
      `[email] Failed to send shipment request notification to ${adminEmail}\n` +
      `Shipment: ${payload.shipmentNumber}\n` +
      `Error: ${String(error)}`
    );
  }
}

export async function sendStockAlertEmail(payload: StockAlertEmailPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      `[email] Cannot send stock alert email for ${payload.product.name}: ` +
      `SMTP not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment.`
    );
    return;
  }

  const from = getFromAddress('TCG Iberia <noreply@tcgiberia.com>');
  const toEmail = (payload.to || '').trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error(
      `[email] Invalid email format for stock alert: ${toEmail}\n` +
      `Product: ${payload.product.name}`
    );
    return;
  }

  console.log(`[email] Sending stock alert email to ${toEmail} for product: ${payload.product.name}`);

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: '¡Tu producto vuelve a estar disponible!',
      html: buildStockAlertHtml(payload),
      text: buildStockAlertText(payload),
    });
    console.log(`[email] ✓ Stock alert email sent to ${toEmail}`);
  } catch (error) {
    console.error(
      `[email] Failed to send stock alert email to ${toEmail}\n` +
      `Product: ${payload.product.name}\n` +
      `Error: ${String(error)}`
    );
  }
}

// --- Shipping notification email ---

function buildShippingNotificationHtml(payload: ShippingNotificationPayload): string {
  const { getTrackingUrl, getProviderLabel } = require('@/lib/shipping/tracking-urls');
  const providerLabel = getProviderLabel(payload.shippingProvider as any);
  const trackingUrl = getTrackingUrl(payload.shippingProvider as any, payload.trackingNumber);
  const trackingLink = trackingUrl 
    ? `<a href="${escapeHtml(trackingUrl)}" style="color:${BRAND.primary};text-decoration:none;font-weight:500;">${escapeHtml(payload.trackingNumber)}</a>`
    : escapeHtml(payload.trackingNumber);

  const content = `
    <tr>
      <td style="padding:32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <h1 style="font-family:${FONT_STACK};font-size:28px;font-weight:700;margin:0 0 8px 0;color:${BRAND.text};">¡Tu pedido está en camino!</h1>
              <p style="font-family:${FONT_STACK};font-size:14px;margin:0 0 24px 0;color:${BRAND.textMuted};">
                Hola ${escapeHtml(payload.fullName)},
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;background:${BRAND.primaryLight};border-radius:8px;border-left:4px solid ${BRAND.primary};margin-bottom:24px;">
              <p style="font-family:${FONT_STACK};font-size:14px;margin:0 0 12px 0;color:${BRAND.text};line-height:1.6;">
                Tu pedido <strong>${escapeHtml(payload.orderNumber)}</strong> ha sido enviado y ya está en tránsito hacia ti.
              </p>
              <p style="font-family:${FONT_STACK};font-size:13px;margin:0;color:${BRAND.textMuted};">
                Recibirás tu paquete en los próximos días. Puedes seguir el estado de tu envío con el número de seguimiento.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <div style="background:${BRAND.bg};padding:20px;border-radius:8px;margin:24px 0;border:1px solid ${BRAND.border};">
                <div style="font-family:${FONT_STACK};font-size:11px;letter-spacing:0.1em;color:${BRAND.textMuted};text-transform:uppercase;font-weight:700;margin-bottom:8px;">Detalles del envío</div>
                <div style="font-family:${FONT_STACK};font-size:13px;color:${BRAND.text};line-height:1.8;">
                  <div><strong>Transportista:</strong> ${escapeHtml(providerLabel)}</div>
                  <div><strong>Número de seguimiento:</strong> ${trackingLink}</div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;border-top:1px solid ${BRAND.border};">
              ${trackingUrl 
                ? `<a href="${escapeHtml(trackingUrl)}" style="display:inline-block;padding:12px 32px;background:${BRAND.primary};color:white;text-decoration:none;border-radius:6px;font-family:${FONT_STACK};font-size:14px;font-weight:600;text-align:center;">Seguir pedido</a>` 
                : ''
              }
              <p style="font-family:${FONT_STACK};font-size:13px;margin:24px 0 0 0;color:${BRAND.textMuted};line-height:1.6;">
                Si tienes alguna pregunta sobre tu pedido, no dudes en contactarnos.
              </p>
              <p style="font-family:${FONT_STACK};font-size:13px;margin:16px 0 0 0;color:${BRAND.textMuted};">
                El equipo de TCG Iberia
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return htmlShell('¡Tu pedido está en camino!', content);
}

function buildShippingNotificationText(payload: ShippingNotificationPayload): string {
  const { getProviderLabel } = require('@/lib/shipping/tracking-urls');
  const providerLabel = getProviderLabel(payload.shippingProvider as any);

  return [
    '¡Tu pedido está en camino!',
    '',
    `Hola ${payload.fullName},`,
    '',
    `Tu pedido ${payload.orderNumber} ha sido enviado y ya está en tránsito hacia ti.`,
    'Recibirás tu paquete en los próximos días.',
    '',
    'Detalles del envío:',
    `Transportista: ${providerLabel}`,
    `Número de seguimiento: ${payload.trackingNumber}`,
    '',
    'El equipo de TCG Iberia',
  ].join('\n');
}

export async function sendShippingNotificationEmail(payload: ShippingNotificationPayload): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      `[email] Cannot send shipping notification email for ${payload.orderNumber}: ` +
      `SMTP not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in environment.`
    );
    return;
  }

  const from = getFromAddress('TCG Iberia <noreply@tcgiberia.com>');
  const toEmail = (payload.email || '').trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error(
      `[email] Invalid email format for shipping notification: ${toEmail}\n` +
      `Order: ${payload.orderNumber}`
    );
    return;
  }

  console.log(`[email] Sending shipping notification email to ${toEmail} for order ${payload.orderNumber}`);

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Tu pedido ${payload.orderNumber} está en camino - TCG Iberia`,
      html: buildShippingNotificationHtml(payload),
      text: buildShippingNotificationText(payload),
    });
    console.log(`[email] ✓ Shipping notification email sent to ${toEmail}`);
  } catch (error) {
    console.error(
      `[email] Failed to send shipping notification email to ${toEmail}\n` +
      `Order: ${payload.orderNumber}\n` +
      `Error: ${String(error)}`
    );
  }
}
