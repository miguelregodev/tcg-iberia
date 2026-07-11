/**
 * PDF invoice generator for accepted B2B orders.
 *
 * Uses `pdf-lib` (no native dependencies, works in any Node runtime — API
 * routes, edge-adjacent workers, Docker, etc.). The PDF is entirely
 * self-contained in a single Buffer that can be attached to emails or
 * streamed back to the browser.
 *
 * Layout (single A4 page):
 *
 *   ┌──────────────────────────────────────────┐
 *   │  [logo]         TCG Iberia               │
 *   │                 Miguel Rego Casas        │
 *   │                 NIF 32692634C            │
 *   │                 …address / phone / mail  │
 *   │                                          │
 *   │  FACTURA FAC-2026-000001                 │
 *   │  Fecha: 08 jul 2026                      │
 *   │  Nº pedido: PED-2026-000042              │
 *   │                                          │
 *   │  Facturar a                              │
 *   │  <company name>                          │
 *   │  NIF <vat>                               │
 *   │  <shipping / billing address>            │
 *   │                                          │
 *   │  ┌───────────────────────────────────┐   │
 *   │  │ Producto  Cant.  P.Unit  Total │   │
 *   │  │ …                                 │   │
 *   │  └───────────────────────────────────┘   │
 *   │                                          │
 *   │                       Base imponible ##  │
 *   │                       IVA 21%         ##  │
 *   │                       Total           ##  │
 *   │                                          │
 *   │  El pedido se preparará cuando la        │
 *   │  factura sea abonada. Factura válida     │
 *   │  durante 24 h por variación de precios.  │
 *   └──────────────────────────────────────────┘
 *
 * Spanish is used throughout. The WinAnsi encoding of the standard
 * Helvetica font covers every Spanish accented character and the euro sign,
 * so no external TTF is bundled.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';
import {
  B2B_COMPANY,
  B2B_COMPANY_ADDRESS_LINES,
  B2B_IVA_RATE,
  B2B_INVOICE_VALIDITY_HOURS,
} from './company';

// ── Public types ────────────────────────────────────────────────────────────

export interface InvoiceItem {
  name: string;
  variant?: 'SHRINK' | 'NO_SHRINK';
  quantity: number;
  unitPriceEur: number;
  lineTotal: number;
}

export interface InvoiceCustomer {
  companyName: string;
  vatNumber: string;
  contactName: string;
  email: string;
  phone: string;
  shippingAddress: string;
  billingAddress?: string | null;
}

export interface InvoicePayload {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: Date;
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  subtotal: number;
  ivaAmount: number;
  total: number;
}

// ── Constants (mm → PDF points) ─────────────────────────────────────────────

const MM = 2.834645669; // 1 mm in PDF points (72dpi / 25.4)
const PAGE = PageSizes.A4; // [595.28, 841.89]
const MARGIN = 20 * MM;
const CONTENT_W = PAGE[0] - MARGIN * 2;

const COLOR_TEXT = rgb(0.07, 0.09, 0.15); // #111827
const COLOR_MUTED = rgb(0.42, 0.45, 0.5); // #6B7280
const COLOR_ACCENT = rgb(0.86, 0.15, 0.15); // #DC2626 (brand red)
const COLOR_BORDER = rgb(0.9, 0.9, 0.92); // #E5E7EB
const COLOR_TABLE_HEAD_BG = rgb(0.976, 0.98, 0.984); // #F9FAFB

// ── Helpers ─────────────────────────────────────────────────────────────────

const eurFmt = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Sanitise text to WinAnsi so pdf-lib doesn't reject characters that the
 * standard Helvetica encoding cannot render (rare emoji, CJK…). Spanish
 * accents and the euro sign ARE supported so this is mostly a safety net.
 */
function sanitize(input: string): string {
  return input.replace(/[\u{10000}-\u{FFFFF}]/gu, '').normalize('NFC');
}

async function readLogoBytes(): Promise<Uint8Array | null> {
  try {
    const abs = path.join(process.cwd(), 'public', 'images', 'logo.png');
    const buf = await fs.readFile(abs);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/** Draw a horizontal line and return the y coordinate below it. */
function hLine(page: ReturnType<PDFDocument['addPage']>, y: number, thickness = 0.5) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness,
    color: COLOR_BORDER,
  });
  return y;
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function generateInvoicePdf(payload: InvoicePayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PAGE);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const text = (
    value: string,
    x: number,
    y: number,
    opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' }
  ) => {
    const font = opts?.bold ? helveticaBold : helvetica;
    const size = opts?.size ?? 10;
    const color = opts?.color ?? COLOR_TEXT;
    const raw = sanitize(value);
    const width = font.widthOfTextAtSize(raw, size);
    const drawX = opts?.align === 'right' ? x - width : x;
    page.drawText(raw, { x: drawX, y, size, font, color });
    return width;
  };

  // ── Header: logo + company data ─────────────────────────────────────────
  let cursorY = PAGE[1] - MARGIN;

  const logoBytes = await readLogoBytes();
  if (logoBytes) {
    try {
      const logo = await doc.embedPng(logoBytes);
      const logoH = 22 * MM;
      const logoW = (logo.width / logo.height) * logoH;
      page.drawImage(logo, {
        x: MARGIN,
        y: cursorY - logoH,
        width: logoW,
        height: logoH,
      });
    } catch {
      // Non-PNG or corrupt image — fall back to just the text header.
    }
  }

  // Company data (right-aligned).
  const rightEdge = MARGIN + CONTENT_W;
  let ry = cursorY - 4;
  text(B2B_COMPANY.brand, rightEdge, ry, { size: 14, bold: true, color: COLOR_ACCENT, align: 'right' });
  ry -= 6 * MM;
  for (const line of B2B_COMPANY_ADDRESS_LINES) {
    text(line, rightEdge, ry, { size: 9, color: COLOR_MUTED, align: 'right' });
    ry -= 4.2 * MM;
  }

  cursorY -= 28 * MM;
  cursorY -= 8 * MM;

  // ── Invoice heading ─────────────────────────────────────────────────────
  text(`Factura ${payload.invoiceNumber}`, MARGIN, cursorY, {
    size: 18,
    bold: true,
  });
  cursorY -= 6 * MM;
  text(`Fecha factura: ${dateFmt.format(payload.invoiceDate)}`, MARGIN, cursorY, {
    size: 10,
    color: COLOR_MUTED,
  });
  cursorY -= 4.5 * MM;
  text(`Nº de pedido: ${payload.orderNumber}`, MARGIN, cursorY, {
    size: 10,
    color: COLOR_MUTED,
  });
  cursorY -= 10 * MM;

  // ── Bill-to block ───────────────────────────────────────────────────────
  text('Facturar a', MARGIN, cursorY, { size: 10, bold: true, color: COLOR_MUTED });
  cursorY -= 5 * MM;
  text(payload.customer.companyName, MARGIN, cursorY, { size: 12, bold: true });
  cursorY -= 5 * MM;
  text(`NIF/CIF: ${payload.customer.vatNumber}`, MARGIN, cursorY, { size: 10 });
  cursorY -= 4.5 * MM;
  text(payload.customer.contactName, MARGIN, cursorY, { size: 10 });
  cursorY -= 4.5 * MM;

  // Show billing address if provided, otherwise the shipping address.
  const address = payload.customer.billingAddress?.trim()
    ? payload.customer.billingAddress
    : payload.customer.shippingAddress;
  for (const line of address.split(/\r?\n/).slice(0, 4)) {
    if (!line.trim()) continue;
    text(line.trim(), MARGIN, cursorY, { size: 10 });
    cursorY -= 4.5 * MM;
  }
  text(`Tel. ${payload.customer.phone}`, MARGIN, cursorY, { size: 10, color: COLOR_MUTED });
  cursorY -= 4.5 * MM;
  text(payload.customer.email, MARGIN, cursorY, { size: 10, color: COLOR_MUTED });
  cursorY -= 10 * MM;

  // ── Items table ─────────────────────────────────────────────────────────
  const colWidths = { desc: 95 * MM, qty: 20 * MM, unit: 30 * MM, total: 25 * MM };
  const rowH = 9.5 * MM;
  const colX = {
    desc: MARGIN,
    qty: MARGIN + colWidths.desc,
    unit: MARGIN + colWidths.desc + colWidths.qty,
    total: MARGIN + colWidths.desc + colWidths.qty + colWidths.unit,
  };

  // Table header band
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - rowH + 1,
    width: CONTENT_W,
    height: rowH,
    color: COLOR_TABLE_HEAD_BG,
    borderColor: COLOR_BORDER,
    borderWidth: 0.5,
  });
  const headBaseline = cursorY - 4.8 * MM;
  text('Descripción', colX.desc + 2 * MM, headBaseline, { size: 9, bold: true, color: COLOR_MUTED });
  text('Cant.', colX.qty + colWidths.qty - 2 * MM, headBaseline, {
    size: 9,
    bold: true,
    color: COLOR_MUTED,
    align: 'right',
  });
  text('P. unitario', colX.unit + colWidths.unit - 2 * MM, headBaseline, {
    size: 9,
    bold: true,
    color: COLOR_MUTED,
    align: 'right',
  });
  text('Importe', colX.total + colWidths.total - 2 * MM, headBaseline, {
    size: 9,
    bold: true,
    color: COLOR_MUTED,
    align: 'right',
  });
  cursorY -= rowH;

  // Rows
  for (const item of payload.items) {
    const variantLabel = item.variant === 'NO_SHRINK' ? ' (sin plástico)' : '';
    const description = `${item.name}${variantLabel}`;
    const baseline = cursorY - 4.8 * MM;
    // Truncate very long descriptions so they never overflow into the quantity column.
    const maxDescW = colWidths.desc - 4 * MM;
    let desc = description;
    while (helvetica.widthOfTextAtSize(desc, 10) > maxDescW && desc.length > 1) {
      desc = desc.slice(0, -2);
    }
    if (desc !== description) desc = `${desc.slice(0, -1)}…`;

    text(desc, colX.desc + 2 * MM, baseline, { size: 10 });
    text(String(item.quantity), colX.qty + colWidths.qty - 2 * MM, baseline, { size: 10, align: 'right' });
    text(eurFmt.format(item.unitPriceEur), colX.unit + colWidths.unit - 2 * MM, baseline, {
      size: 10,
      align: 'right',
    });
    text(eurFmt.format(item.lineTotal), colX.total + colWidths.total - 2 * MM, baseline, {
      size: 10,
      align: 'right',
      bold: true,
    });

    page.drawLine({
      start: { x: MARGIN, y: cursorY - rowH + 1 },
      end: { x: MARGIN + CONTENT_W, y: cursorY - rowH + 1 },
      thickness: 0.3,
      color: COLOR_BORDER,
    });
    cursorY -= rowH;
  }

  // ── Totals block ─────────────────────────────────────────────────────
  cursorY -= 6 * MM;
  const totalsX = MARGIN + CONTENT_W;

  const drawTotalRow = (label: string, value: number, opts?: { bold?: boolean; color?: ReturnType<typeof rgb>; size?: number }) => {
    const size = opts?.size ?? 10;
    const labelX = totalsX - 60 * MM;
    text(label, labelX, cursorY, { size, color: opts?.color ?? COLOR_MUTED, bold: opts?.bold });
    text(eurFmt.format(value), totalsX, cursorY, {
      size,
      color: opts?.color ?? COLOR_TEXT,
      bold: opts?.bold,
      align: 'right',
    });
    cursorY -= 16;
  };

  drawTotalRow('Base imponible', payload.subtotal);
  drawTotalRow(`IVA (${(B2B_IVA_RATE * 100).toFixed(0)}%)`, payload.ivaAmount);

  // Separación
  cursorY -= 8;

  // Total
  drawTotalRow('Total', payload.total, {
    bold: true,
    color: COLOR_ACCENT,
    size: 12,
  });

  // ── Footer note ─────────────────────────────────────────────────────────
  let footerY = MARGIN + 40 * MM;
  // Datos de pago
  text(
    'Pago mediante transferencia bancaria',
    MARGIN,
    footerY,
    {
      size: 10,
      bold: true,
    }
  );

  footerY -= 6 * MM;

  text(
    'IBAN: ' + B2B_COMPANY.iban,
    MARGIN,
    footerY,
    {
      size: 10,
    }
  );

  footerY -= 7 * MM;

  hLine(page, footerY);

  footerY -= 6 * MM;

  text(
    'El pedido se preparará una vez la factura haya sido abonada.',
    MARGIN,
    footerY,
    {
      size: 9,
      color: COLOR_MUTED,
    }
  );

  footerY -= 5 * MM;

  text(
    `Esta factura es válida durante ${B2B_INVOICE_VALIDITY_HOURS} horas debido a la variación de precios.`,
    MARGIN,
    footerY,
    {
      size: 9,
      color: COLOR_MUTED,
    }
  );

  return doc.save();
}
