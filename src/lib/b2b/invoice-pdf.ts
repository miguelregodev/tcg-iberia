/**
 * PDF renderer for every B2B document type (invoice, proforma, quotation,
 * corrective invoice).
 *
 * Uses `pdf-lib` (no native dependencies). Renders ONLY from the frozen
 * `B2bDocumentPayload` persisted on the B2bDocument row — never from the
 * live catalog or customer record — so re-rendering a failed document
 * produces exactly the content that was issued.
 *
 * Layout (A4, flows onto extra pages when there are many lines):
 *   header      logo + seller data (frozen in payload)
 *   heading     document title / number / dates / order ref / fiscal notice
 *   bill-to     customer fiscal data + shipping address
 *   lines       Ref./Descripción · Cant. · P. unit. · Dto. · IVA · Importe
 *   totals      gross, discounts, subtotal, shipping, VAT breakdown,
 *               Recargo de Equivalencia (when applicable), total
 *   footer      payment instructions / legal notes per document type
 *
 * WinAnsi (standard Helvetica) covers Spanish accents and €; any other
 * character is replaced so rendering never fails on exotic product names.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb, PageSizes, type PDFFont, type PDFPage } from 'pdf-lib';
import type {
  B2bCustomerSnapshot,
  B2bDocumentTypeValue,
  B2bOrderLineSnapshot,
  B2bPaymentStatusValue,
} from '@/types';
import { B2B_DOCUMENT_TYPE_LABEL, B2B_PAYMENT_STATUS_LABEL } from './order-status';

// ── Public types ────────────────────────────────────────────────────────────

export interface B2bDocumentSeller {
  brand: string;
  addressLines: string[];
  iban: string;
}

export interface B2bDocumentPayload {
  version: 1;
  type: B2bDocumentTypeValue;
  number: string;
  issuedAt: string;
  orderNumber: string;
  orderDate: string;
  seller: B2bDocumentSeller;
  /** Customer fiscal data at issue time. */
  customer: B2bCustomerSnapshot;
  /** Shipping address frozen on the order. */
  shippingAddress: string;
  /** Lines from the order snapshot (amounts negated for corrective invoices). */
  items: B2bOrderLineSnapshot[];
  grossTotal: number;
  discountTotal: number;
  subtotal: number;
  shippingCost: number;
  vatBreakdown: Array<{ rate: number; base: number; amount: number }>;
  ivaAmount: number;
  /** Recargo de Equivalencia; null/absent when the customer is not under that regime. */
  equivalenceSurcharge?: { rate: number; base: number; amount: number } | null;
  total: number;
  paymentStatus: B2bPaymentStatusValue;
  validityHours: number;
  corrects: { number: string; issuedAt: string } | null;
  correctionReason: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MM = 2.834645669;
const PAGE = PageSizes.A4;
const MARGIN = 18 * MM;
const CONTENT_W = PAGE[0] - MARGIN * 2;
const BOTTOM_LIMIT = MARGIN + 14 * MM;

const COLOR_TEXT = rgb(0.07, 0.09, 0.15);
const COLOR_MUTED = rgb(0.42, 0.45, 0.5);
const COLOR_ACCENT = rgb(0.86, 0.15, 0.15);
const COLOR_BORDER = rgb(0.9, 0.9, 0.92);
const COLOR_TABLE_HEAD_BG = rgb(0.976, 0.98, 0.984);
const COLOR_NOTICE_BG = rgb(1, 0.96, 0.9);

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
  timeZone: 'Europe/Madrid',
});
const pctFmt = (rate: number) => `${Number((rate * 100).toFixed(2)).toLocaleString('es-ES')}%`;

const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Replace characters the standard Helvetica (WinAnsi) font cannot encode. */
export function toWinAnsi(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === '\t') out += ' ';
    else if (code < 0x20 && ch !== '\n') continue;
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else out += '?';
  }
  return out;
}

async function readLogoBytes(): Promise<Uint8Array | null> {
  try {
    const buf = await fs.readFile(path.join(process.cwd(), 'public', 'images', 'logo.png'));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

const TITLES: Record<B2bDocumentTypeValue, string> = {
  INVOICE: 'Factura',
  PROFORMA: 'Factura proforma',
  QUOTATION: 'Presupuesto',
  CORRECTIVE_INVOICE: 'Factura rectificativa',
};

// ── Renderer ────────────────────────────────────────────────────────────────

export async function generateB2bDocumentPdf(payload: B2bDocumentPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${TITLES[payload.type]} ${payload.number}`);
  doc.setAuthor(payload.seller.brand);
  doc.setCreationDate(new Date(payload.issuedAt));

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readLogoBytes();
  const logo = logoBytes ? await doc.embedPng(logoBytes).catch(() => null) : null;

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  type TextOpts = { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'right' };
  const fontFor = (o?: TextOpts): PDFFont => (o?.bold ? bold : regular);
  const text = (value: string, x: number, yy: number, o?: TextOpts) => {
    const font = fontFor(o);
    const size = o?.size ?? 10;
    const raw = toWinAnsi(value);
    const width = font.widthOfTextAtSize(raw, size);
    page.drawText(raw, { x: o?.align === 'right' ? x - width : x, y: yy, size, font, color: o?.color ?? COLOR_TEXT });
  };
  const fit = (value: string, maxWidth: number, size: number, font: PDFFont) => {
    let s = toWinAnsi(value);
    if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
    while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > maxWidth) s = s.slice(0, -1);
    return `${s}…`;
  };
  const wrap = (value: string, maxWidth: number, size: number, font: PDFFont): string[] => {
    const words = toWinAnsi(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
      else {
        if (current) lines.push(current);
        current = fit(w, maxWidth, size, font);
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const hLine = (yy: number) =>
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: MARGIN + CONTENT_W, y: yy }, thickness: 0.5, color: COLOR_BORDER });

  const isCorrective = payload.type === 'CORRECTIVE_INVOICE';
  const isFiscal = payload.type === 'INVOICE' || isCorrective;
  const right = MARGIN + CONTENT_W;

  // ── Header ──────────────────────────────────────────────────────────────
  if (logo) {
    const h = 20 * MM;
    page.drawImage(logo, { x: MARGIN, y: y - h, width: (logo.width / logo.height) * h, height: h });
  }
  let ry = y - 4;
  text(payload.seller.brand, right, ry, { size: 14, bold: true, color: COLOR_ACCENT, align: 'right' });
  ry -= 6 * MM;
  for (const line of payload.seller.addressLines) {
    text(line, right, ry, { size: 8.5, color: COLOR_MUTED, align: 'right' });
    ry -= 4 * MM;
  }
  y = Math.min(y - 24 * MM, ry) - 6 * MM;

  // ── Heading ─────────────────────────────────────────────────────────────
  text(`${TITLES[payload.type]} ${payload.number}`, MARGIN, y, { size: 17, bold: true });
  y -= 6 * MM;
  text(`Fecha de emisión: ${dateFmt.format(new Date(payload.issuedAt))}`, MARGIN, y, { size: 9.5, color: COLOR_MUTED });
  text(`Nº de pedido: ${payload.orderNumber}`, right, y, { size: 9.5, color: COLOR_MUTED, align: 'right' });
  y -= 4.5 * MM;
  text(`Fecha del pedido: ${dateFmt.format(new Date(payload.orderDate))}`, MARGIN, y, { size: 9.5, color: COLOR_MUTED });
  if (payload.type === 'INVOICE' || payload.type === 'PROFORMA') {
    text(
      `Estado del pago a la emisión: ${B2B_PAYMENT_STATUS_LABEL[payload.paymentStatus]}`,
      right,
      y,
      { size: 9.5, color: COLOR_MUTED, align: 'right' }
    );
  }
  y -= 6 * MM;

  const notice: string[] = [];
  if (!isFiscal) {
    notice.push(`${B2B_DOCUMENT_TYPE_LABEL[payload.type]}: documento sin validez fiscal. No constituye una factura.`);
  }
  if (isCorrective && payload.corrects) {
    notice.push(
      `Rectifica la factura ${payload.corrects.number} de fecha ${dateFmt.format(new Date(payload.corrects.issuedAt))}.`
    );
    if (payload.correctionReason) notice.push(`Motivo: ${payload.correctionReason}`);
  }
  if (notice.length > 0) {
    const lines = notice.flatMap((n) => wrap(n, CONTENT_W - 6 * MM, 9, bold));
    const boxH = lines.length * 4.5 * MM + 4 * MM;
    page.drawRectangle({ x: MARGIN, y: y - boxH + 4 * MM, width: CONTENT_W, height: boxH, color: COLOR_NOTICE_BG });
    for (const l of lines) {
      text(l, MARGIN + 3 * MM, y, { size: 9, bold: true });
      y -= 4.5 * MM;
    }
    y -= 4 * MM;
  } else {
    y -= 2 * MM;
  }

  // ── Bill-to / ship-to ───────────────────────────────────────────────────
  const colW = CONTENT_W / 2 - 4 * MM;
  const billX = MARGIN;
  const shipX = MARGIN + CONTENT_W / 2 + 4 * MM;
  let by = y;
  text(isFiscal ? 'Facturar a' : 'Cliente', billX, by, { size: 9, bold: true, color: COLOR_MUTED });
  by -= 5 * MM;
  text(fit(payload.customer.companyName, colW, 11, bold), billX, by, { size: 11, bold: true });
  by -= 4.8 * MM;
  text(`NIF/CIF: ${payload.customer.vatNumber}`, billX, by, { size: 9.5 });
  by -= 4.3 * MM;
  if (payload.equivalenceSurcharge) {
    text('Régimen de Recargo de Equivalencia', billX, by, { size: 8.5, color: COLOR_MUTED });
    by -= 4.3 * MM;
  }
  text(fit(payload.customer.contactName, colW, 9.5, regular), billX, by, { size: 9.5 });
  by -= 4.3 * MM;
  const billing = payload.customer.billingAddress?.trim() || payload.customer.shippingAddress;
  for (const l of billing.split(/\r?\n/).flatMap((s) => wrap(s, colW, 9.5, regular)).slice(0, 4)) {
    text(l, billX, by, { size: 9.5 });
    by -= 4.3 * MM;
  }
  text(fit(`${payload.customer.email} · Tel. ${payload.customer.phone}`, colW, 8.5, regular), billX, by, {
    size: 8.5,
    color: COLOR_MUTED,
  });
  by -= 4.3 * MM;

  let sy = y;
  text('Dirección de envío', shipX, sy, { size: 9, bold: true, color: COLOR_MUTED });
  sy -= 5 * MM;
  for (const l of payload.shippingAddress.split(/\r?\n/).flatMap((s) => wrap(s, colW, 9.5, regular)).slice(0, 5)) {
    text(l, shipX, sy, { size: 9.5 });
    sy -= 4.3 * MM;
  }
  y = Math.min(by, sy) - 6 * MM;

  // ── Lines table ─────────────────────────────────────────────────────────
  const cols = [
    { key: 'desc', label: 'Ref. / Descripción', w: 80 * MM, align: 'left' as const },
    { key: 'qty', label: 'Cant.', w: 14 * MM, align: 'right' as const },
    { key: 'unit', label: 'P. unit.', w: 22 * MM, align: 'right' as const },
    { key: 'dto', label: 'Dto.', w: 14 * MM, align: 'right' as const },
    { key: 'iva', label: 'IVA', w: 12 * MM, align: 'right' as const },
    { key: 'total', label: 'Importe', w: CONTENT_W - 142 * MM, align: 'right' as const },
  ];
  const colX: number[] = [];
  cols.reduce((x, c) => {
    colX.push(x);
    return x + c.w;
  }, MARGIN);
  const cellX = (i: number) => (cols[i].align === 'right' ? colX[i] + cols[i].w - 2 * MM : colX[i] + 2 * MM);

  const drawTableHeader = () => {
    const h = 8 * MM;
    page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: COLOR_TABLE_HEAD_BG, borderColor: COLOR_BORDER, borderWidth: 0.5 });
    cols.forEach((c, i) => text(c.label, cellX(i), y - 5.3 * MM, { size: 8.5, bold: true, color: COLOR_MUTED, align: c.align }));
    y -= h;
  };
  const newPage = () => {
    page = doc.addPage(PAGE);
    y = PAGE[1] - MARGIN;
    text(`${TITLES[payload.type]} ${payload.number} (continuación)`, MARGIN, y, { size: 10, bold: true, color: COLOR_MUTED });
    y -= 8 * MM;
  };

  drawTableHeader();
  for (const item of payload.items) {
    const rowH = item.sku ? 11 * MM : 8 * MM;
    if (y - rowH < BOTTOM_LIMIT) {
      newPage();
      drawTableHeader();
    }
    const base = y - 5.2 * MM;
    text(fit(item.name, cols[0].w - 4 * MM, 9.5, regular), cellX(0), base, { size: 9.5 });
    if (item.sku) {
      text(fit(`Ref. ${item.sku}`, cols[0].w - 4 * MM, 7.5, regular), cellX(0), base - 4 * MM, { size: 7.5, color: COLOR_MUTED });
    }
    text(String(item.quantity), cellX(1), base, { size: 9.5, align: 'right' });
    text(eurFmt.format(item.unitPriceEur), cellX(2), base, { size: 9.5, align: 'right' });
    text(item.discountPercent ? pctFmt(item.discountPercent / 100) : '—', cellX(3), base, { size: 9.5, align: 'right' });
    text(pctFmt(item.vatRate ?? payload.vatBreakdown[0]?.rate ?? 0.21), cellX(4), base, { size: 9.5, align: 'right' });
    text(eurFmt.format(item.lineTotal), cellX(5), base, { size: 9.5, bold: true, align: 'right' });
    hLine(y - rowH);
    y -= rowH;
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const totalsRows: Array<{ label: string; value: number; strong?: boolean }> = [];
  if (payload.discountTotal !== 0) {
    totalsRows.push({ label: 'Importe bruto', value: payload.grossTotal });
    totalsRows.push({ label: 'Descuentos', value: -payload.discountTotal });
  }
  totalsRows.push({ label: 'Subtotal productos', value: payload.subtotal });
  if (payload.shippingCost !== 0) totalsRows.push({ label: 'Gastos de envío', value: payload.shippingCost });
  for (const v of payload.vatBreakdown) {
    totalsRows.push({ label: `Base imponible`, value: v.base });
    totalsRows.push({ label: `IVA ${pctFmt(v.rate)}`, value: v.amount });
  }
  if (payload.equivalenceSurcharge && payload.equivalenceSurcharge.amount !== 0) {
    totalsRows.push({
      label: `Recargo de Equivalencia ${pctFmt(payload.equivalenceSurcharge.rate)}`,
      value: payload.equivalenceSurcharge.amount,
    });
  }

  const footerHeight = 34 * MM;
  const totalsHeight = (totalsRows.length + 2) * 5.6 * MM + 8 * MM;
  if (y - totalsHeight - footerHeight < MARGIN) newPage();

  y -= 7 * MM;
  const labelX = right - 70 * MM;
  for (const row of totalsRows) {
    text(row.label, labelX, y, { size: 9.5, color: COLOR_MUTED });
    text(eurFmt.format(row.value), right, y, { size: 9.5, align: 'right' });
    y -= 5.6 * MM;
  }
  y -= 1.5 * MM;
  page.drawLine({ start: { x: labelX, y: y + 4 * MM }, end: { x: right, y: y + 4 * MM }, thickness: 0.8, color: COLOR_TEXT });
  text('Total', labelX, y - 1 * MM, { size: 12, bold: true, color: COLOR_ACCENT });
  text(eurFmt.format(payload.total), right, y - 1 * MM, { size: 12, bold: true, color: COLOR_ACCENT, align: 'right' });

  // ── Footer ──────────────────────────────────────────────────────────────
  let fy = MARGIN + footerHeight - 6 * MM;
  const footerNote = (s: string) => {
    for (const l of wrap(s, CONTENT_W, 8.5, regular)) {
      text(l, MARGIN, fy, { size: 8.5, color: COLOR_MUTED });
      fy -= 4.2 * MM;
    }
  };
  if (payload.type === 'INVOICE' || payload.type === 'PROFORMA') {
    text('Pago mediante transferencia bancaria', MARGIN, fy, { size: 9.5, bold: true });
    fy -= 5 * MM;
    text(`IBAN: ${payload.seller.iban}  ·  Concepto: ${payload.number}`, MARGIN, fy, { size: 9.5 });
    fy -= 5 * MM;
  }
  hLine(fy + 2 * MM);
  fy -= 3 * MM;
  switch (payload.type) {
    case 'INVOICE':
      footerNote('El pedido se preparará una vez la factura haya sido abonada.');
      footerNote(`Esta factura es válida durante ${payload.validityHours} horas debido a la variación de precios.`);
      break;
    case 'PROFORMA':
      footerNote('Factura proforma emitida a efectos informativos y de pago anticipado. La factura definitiva se emitirá al confirmar el pedido.');
      footerNote(`Importes válidos durante ${payload.validityHours} horas debido a la variación de precios.`);
      break;
    case 'QUOTATION':
      footerNote(`Presupuesto válido durante ${payload.validityHours} horas debido a la variación de precios. Sujeto a disponibilidad.`);
      break;
    case 'CORRECTIVE_INVOICE':
      footerNote('Factura rectificativa emitida conforme al artículo 15 del Real Decreto 1619/2012. Los importes negativos anulan los de la factura rectificada.');
      break;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = toWinAnsi(`${payload.number} · Página ${i + 1} de ${pages.length}`);
    p.drawText(label, {
      x: MARGIN + CONTENT_W - regular.widthOfTextAtSize(label, 7.5),
      y: MARGIN / 2,
      size: 7.5,
      font: regular,
      color: COLOR_MUTED,
    });
  });

  return doc.save();
}
