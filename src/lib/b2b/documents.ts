/**
 * B2B document service — issues, retries and serves invoices, proformas,
 * quotations and corrective invoices for B2B orders.
 *
 * Flow for a new document:
 *   1. Validate eligibility (order state + existing documents) and the
 *      customer's NIF/CIF (needed for the file name and the document itself).
 *   2. In ONE transaction: take the number (fiscal documents: the number the
 *      admin entered, always required and unique; proformas/quotations: the
 *      admin's number or the next of their series), freeze the render payload
 *      (order snapshot + customer fiscal data + seller data), compute the
 *      deterministic storage key and insert the B2bDocument row as
 *      GENERATING. A unique `uniquenessKey` blocks duplicate/concurrent active
 *      documents; if the transaction fails any series increment rolls back.
 *   3. Outside the transaction: render the PDF (in memory — no temp files),
 *      upload it to the private bucket, then mark the row ISSUED.
 *
 * Failure handling:
 *   - PDF or upload failure → row marked FAILED with a sanitized message
 *     (no secrets / stack traces), audit event + Sentry. The order and the
 *     reserved number are kept; admins retry from the order detail.
 *   - Upload OK but the final DB update fails → the object already lives at
 *     the persisted `storageKey`, so it is never orphaned: the next retry
 *     detects it (HEAD) and completes without uploading a duplicate.
 *   - Retries reuse the same number, payload and storage key, so they never
 *     create duplicate documents or files.
 *
 * ISSUED documents are immutable: they are never re-rendered or overwritten.
 */

import type { B2bCustomer, B2bDocument, B2bDocumentType, B2bOrder, Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nextjs';
import { db } from '@/lib/db';
import { B2B_COMPANY, B2B_COMPANY_ADDRESS_LINES, B2B_INVOICE_VALIDITY_HOURS } from './company';
import { generateB2bDocumentNumber, requiresManualDocumentNumber } from './order-numbers';
import { generateB2bDocumentPdf, type B2bDocumentPayload } from './invoice-pdf';
import { getB2bDocumentObject, headB2bDocumentObject, putB2bDocumentObject } from './document-storage';
import { recordB2bOrderEvent, recordB2bOrderEventSafe } from './audit';
import { getDocumentEligibility } from './order-status';
import { B2bServiceError } from './errors';
import { customerToSnapshot, readCustomerSnapshot, readOrderItems } from './snapshots';
import { fromCents, toCents } from './pricing';
import { sendB2bDocumentEmail } from './emails';

/** A GENERATING row older than this is considered abandoned and may be retried. */
export const GENERATION_LOCK_MS = 3 * 60 * 1000;

const STORAGE_FOLDER: Record<B2bDocumentType, string> = {
  INVOICE: 'invoices',
  PROFORMA: 'proformas',
  QUOTATION: 'quotations',
  CORRECTIVE_INVOICE: 'corrective-invoices',
};

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Normalise a NIF/CIF/VAT number for use in file names: uppercase A–Z/0–9
 * only (strips spaces, dashes, dots, slashes, path separators…). Returns
 * null when the result is not a plausible tax ID.
 */
export function sanitizeTaxId(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 5 || cleaned.length > 20 || !/\d/.test(cleaned)) return null;
  return cleaned;
}

function madridParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** `<NIF>_<YYYYMMDD>_<HHmmss>.pdf` (Europe/Madrid time), e.g. `B12345678_20261119_183045.pdf`. */
export function buildDocumentFileName(taxId: string, date: Date): string {
  const p = madridParts(date);
  return `${taxId}_${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}.pdf`;
}

/**
 * `<type folder>/<YYYY>/<document number>/<file name>`. The document number
 * is unique, so two documents generated in the same second for the same
 * customer can never collide while the file name keeps the required format.
 */
export function buildDocumentStorageKey(
  type: B2bDocumentType,
  number: string,
  fileName: string,
  issuedAt: Date
): string {
  const safeNumber = number.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return `${STORAGE_FOLDER[type]}/${madridParts(issuedAt).year}/${safeNumber}/${fileName}`;
}

/** User-safe error description: stage + error class, never raw messages (may contain endpoints/keys). */
export function describeGenerationError(stage: 'pdf' | 'storage' | 'database', err: unknown): string {
  const name = err instanceof Error ? err.name : 'Error';
  const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  const detail = `${name}${status ? ` ${status}` : ''}`;
  switch (stage) {
    case 'pdf':
      return `No se pudo generar el PDF (${detail}).`;
    case 'storage':
      return `No se pudo guardar el PDF en el almacenamiento privado (${detail}).`;
    default:
      return `El PDF se guardó pero no se pudo registrar en la base de datos (${detail}). Reintenta para completarlo.`;
  }
}

type OrderForPayload = Pick<
  B2bOrder,
  | 'orderNumber'
  | 'createdAt'
  | 'items'
  | 'customerSnapshot'
  | 'subtotal'
  | 'discountTotal'
  | 'shippingCost'
  | 'vatRate'
  | 'ivaAmount'
  | 'surchargeRate'
  | 'surchargeAmount'
  | 'total'
  | 'paymentStatus'
>;

/**
 * Build the frozen render payload. Items and amounts come exclusively from
 * the order snapshot; customer fiscal data is taken at issue time (the
 * invoice must show the customer's fiscal data as of its issue date).
 * Corrective invoices negate every amount of the original order.
 */
export function buildDocumentPayload(input: {
  type: B2bDocumentType;
  number: string;
  issuedAt: Date;
  order: OrderForPayload;
  customer: Parameters<typeof customerToSnapshot>[0];
  corrects?: { number: string; issuedAt: Date } | null;
  correctionReason?: string | null;
}): B2bDocumentPayload {
  const { order } = input;
  const sign = input.type === 'CORRECTIVE_INVOICE' ? -1 : 1;
  const neg = (v: number) => fromCents(toCents(v) * sign);
  const subtotal = Number(order.subtotal);
  const discountTotal = Number(order.discountTotal);
  const shippingCost = Number(order.shippingCost);
  const vatRate = Number(order.vatRate);
  const ivaAmount = Number(order.ivaAmount);
  const surchargeRate = Number(order.surchargeRate ?? 0);
  const surchargeAmount = Number(order.surchargeAmount ?? 0);
  const orderSnapshot = readCustomerSnapshot(order.customerSnapshot);

  return {
    version: 1,
    type: input.type,
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    orderNumber: order.orderNumber,
    orderDate: order.createdAt.toISOString(),
    seller: {
      brand: B2B_COMPANY.brand,
      addressLines: [...B2B_COMPANY_ADDRESS_LINES],
      iban: B2B_COMPANY.iban,
    },
    customer: customerToSnapshot(input.customer),
    shippingAddress: orderSnapshot.shippingAddress || input.customer.shippingAddress,
    items: readOrderItems(order.items).map((i) => ({
      ...i,
      quantity: i.quantity * sign,
      discountAmountEur: neg(i.discountAmountEur ?? 0),
      lineTotal: neg(i.lineTotal),
      vatRate: i.vatRate ?? vatRate,
    })),
    grossTotal: neg(subtotal + discountTotal),
    discountTotal: neg(discountTotal),
    subtotal: neg(subtotal),
    shippingCost: neg(shippingCost),
    vatBreakdown: [{ rate: vatRate, base: neg(subtotal + shippingCost), amount: neg(ivaAmount) }],
    ivaAmount: neg(ivaAmount),
    equivalenceSurcharge:
      surchargeRate > 0
        ? { rate: surchargeRate, base: neg(subtotal + shippingCost), amount: neg(surchargeAmount) }
        : null,
    total: neg(Number(order.total)),
    paymentStatus: order.paymentStatus,
    validityHours: B2B_INVOICE_VALIDITY_HOURS,
    corrects: input.corrects
      ? { number: input.corrects.number, issuedAt: input.corrects.issuedAt.toISOString() }
      : null,
    correctionReason: input.correctionReason ?? null,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2002';
}

// ── Generation ──────────────────────────────────────────────────────────────

export interface DocumentOutcome {
  document: B2bDocument;
  issued: boolean;
  /** In-memory PDF of a freshly rendered document (for immediate emailing). */
  pdf: Uint8Array | null;
  error: string | null;
}

async function markFailed(
  doc: B2bDocument,
  actor: string,
  stage: 'pdf' | 'storage' | 'database',
  err: unknown
): Promise<DocumentOutcome> {
  const message = describeGenerationError(stage, err);
  Sentry.captureException(err, {
    tags: { module: 'b2b', action: 'document_generation', stage },
    extra: { documentId: doc.id, orderId: doc.orderId, type: doc.type },
  });
  let document: B2bDocument = { ...doc, status: 'FAILED', lastError: message };
  try {
    document = await db.$transaction(async (tx) => {
      const row = await tx.b2bDocument.update({
        where: { id: doc.id },
        data: { status: 'FAILED', lastError: message },
      });
      await recordB2bOrderEvent(tx, doc.orderId, 'DOCUMENT_GENERATION_FAILED', actor, {
        documentId: doc.id,
        type: doc.type,
        number: doc.number,
        stage,
        error: message,
      });
      return row;
    });
  } catch (persistErr) {
    // The row stays GENERATING; it becomes retryable once GENERATION_LOCK_MS elapses.
    console.error('[b2b/documents] Could not persist FAILED state:', persistErr instanceof Error ? persistErr.name : 'unknown');
  }
  return { document, issued: false, pdf: null, error: message };
}

async function renderAndStore(doc: B2bDocument, actor: string): Promise<DocumentOutcome> {
  if (!doc.payload || !doc.storageKey) {
    return markFailed(doc, actor, 'pdf', new Error('MissingPayload'));
  }
  const payload = doc.payload as unknown as B2bDocumentPayload;
  let pdf: Uint8Array | null = null;
  let size = 0;
  let stage: 'pdf' | 'storage' = 'storage';

  try {
    const alreadyStored = doc.attempts > 1 ? await headB2bDocumentObject(doc.storageKey) : null;
    if (alreadyStored && alreadyStored.size > 0) {
      size = alreadyStored.size;
    } else {
      stage = 'pdf';
      pdf = await generateB2bDocumentPdf(payload);
      stage = 'storage';
      await putB2bDocumentObject(doc.storageKey, pdf);
      size = pdf.byteLength;
    }
  } catch (err) {
    return markFailed(doc, actor, stage, err);
  }

  try {
    const document = await db.$transaction(async (tx) => {
      const row = await tx.b2bDocument.update({
        where: { id: doc.id },
        data: { status: 'ISSUED', fileSize: size, generatedAt: new Date(), lastError: null },
      });
      await recordB2bOrderEvent(tx, doc.orderId, 'DOCUMENT_GENERATED', actor, {
        documentId: doc.id,
        type: doc.type,
        number: doc.number,
        attempt: doc.attempts,
        ...(pdf ? {} : { recoveredExistingFile: true }),
      });
      return row;
    });
    return { document, issued: true, pdf, error: null };
  } catch (err) {
    return markFailed(doc, actor, 'database', err);
  }
}

export async function issueB2bDocument(input: {
  orderId: string;
  type: B2bDocumentType;
  actor: string;
  correctsDocumentId?: string | null;
  correctionReason?: string | null;
  /** Admin-assigned number (already validated with normalizeManualDocumentNumber). Null = next in series. */
  manualNumber?: string | null;
}): Promise<DocumentOutcome> {
  const order = await db.b2bOrder.findUnique({
    where: { id: input.orderId },
    include: { customer: true, documents: true },
  });
  if (!order) throw new B2bServiceError('Pedido no encontrado.', 404);

  const eligibility = getDocumentEligibility(order, order.documents, input.type, input.correctsDocumentId);
  if (!eligibility.ok) throw new B2bServiceError(eligibility.error, 409);
  if (input.type === 'CORRECTIVE_INVOICE' && !input.correctionReason) {
    throw new B2bServiceError('Indica el motivo de la rectificación.', 422);
  }
  if (requiresManualDocumentNumber(input.type) && !input.manualNumber) {
    throw new B2bServiceError('Introduce el número de factura: las facturas siempre se numeran manualmente.', 422);
  }
  return createAndRender(order, input);
}

async function createAndRender(
  order: B2bOrder & { customer: B2bCustomer; documents: B2bDocument[] },
  input: {
    type: B2bDocumentType;
    actor: string;
    correctsDocumentId?: string | null;
    correctionReason?: string | null;
    manualNumber?: string | null;
  }
): Promise<DocumentOutcome> {
  const taxId = sanitizeTaxId(order.customer.vatNumber);
  if (!taxId) {
    throw new B2bServiceError(
      'El cliente no tiene un NIF/CIF válido. Corrígelo en su ficha antes de generar documentos.',
      422
    );
  }
  const target =
    input.type === 'CORRECTIVE_INVOICE'
      ? order.documents.find((d) => d.id === input.correctsDocumentId) ?? null
      : null;

  const issuedAt = new Date();
  let created: B2bDocument;
  try {
    created = await db.$transaction(async (tx) => {
      let number: string;
      if (input.manualNumber) {
        const taken = await tx.b2bDocument.findUnique({ where: { number: input.manualNumber }, select: { id: true } });
        if (taken) throw new B2bServiceError(`El número ${input.manualNumber} ya está asignado a otro documento.`, 409);
        number = input.manualNumber;
      } else {
        number = await generateB2bDocumentNumber(input.type, tx);
      }
      const payload = buildDocumentPayload({
        type: input.type,
        number,
        issuedAt,
        order,
        customer: order.customer,
        corrects: target,
        correctionReason: input.correctionReason,
      });
      const fileName = buildDocumentFileName(taxId, issuedAt);
      if (target) {
        // Release the original invoice's active slot: it is now rectified.
        await tx.b2bDocument.update({ where: { id: target.id }, data: { uniquenessKey: null } });
      }
      return tx.b2bDocument.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          type: input.type,
          status: 'GENERATING',
          number,
          issuedAt,
          total: payload.total,
          payload: payload as unknown as Prisma.InputJsonValue,
          storageKey: buildDocumentStorageKey(input.type, number, fileName, issuedAt),
          fileName,
          attempts: 1,
          lastAttemptAt: issuedAt,
          uniquenessKey: target ? `corrects:${target.id}` : `${order.id}:${input.type}`,
          correctsDocumentId: target?.id ?? null,
          correctionReason: input.correctionReason ?? null,
          createdBy: input.actor,
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const target = (err as { meta?: { target?: unknown } }).meta?.target;
      if (input.manualNumber && JSON.stringify(target ?? '').includes('number')) {
        throw new B2bServiceError(`El número ${input.manualNumber} ya está asignado a otro documento.`, 409);
      }
      throw new B2bServiceError(
        'Ya existe (o se está generando) un documento de este tipo para el pedido. Recarga la página.',
        409
      );
    }
    throw err;
  }

  return renderAndStore(created, input.actor);
}

export async function retryB2bDocument(input: {
  orderId: string;
  documentId: string;
  actor: string;
}): Promise<DocumentOutcome> {
  const doc = await db.b2bDocument.findFirst({
    where: { id: input.documentId, orderId: input.orderId },
    include: { order: { include: { customer: true } }, correctsDocument: true },
  });
  if (!doc) throw new B2bServiceError('Documento no encontrado.', 404);
  if (doc.status === 'ISSUED') {
    throw new B2bServiceError('El documento ya está emitido y no puede regenerarse.', 409);
  }
  if (
    doc.status === 'GENERATING' &&
    doc.lastAttemptAt &&
    Date.now() - doc.lastAttemptAt.getTime() < GENERATION_LOCK_MS
  ) {
    throw new B2bServiceError('La generación está en curso. Espera unos instantes y recarga.', 409);
  }

  const now = new Date();
  const data: Prisma.B2bDocumentUpdateManyMutationInput = {
    status: 'GENERATING',
    lastAttemptAt: now,
    attempts: { increment: 1 },
  };
  if (!doc.payload || !doc.storageKey) {
    // Legacy invoices (issued before private storage existed): freeze the
    // payload now, preserving the original number and issue date.
    const taxId = sanitizeTaxId(doc.order.customer.vatNumber);
    if (!taxId) {
      throw new B2bServiceError(
        'El cliente no tiene un NIF/CIF válido. Corrígelo en su ficha antes de generar documentos.',
        422
      );
    }
    const fileName = buildDocumentFileName(taxId, doc.issuedAt);
    data.payload = buildDocumentPayload({
      type: doc.type,
      number: doc.number,
      issuedAt: doc.issuedAt,
      order: doc.order,
      customer: doc.order.customer,
      corrects: doc.correctsDocument,
      correctionReason: doc.correctionReason,
    }) as unknown as Prisma.InputJsonValue;
    data.fileName = fileName;
    data.storageKey = buildDocumentStorageKey(doc.type, doc.number, fileName, doc.issuedAt);
  }

  const claimed = await db.b2bDocument.updateMany({
    where: { id: doc.id, status: doc.status, updatedAt: doc.updatedAt },
    data,
  });
  if (claimed.count !== 1) {
    throw new B2bServiceError('Otro proceso está generando este documento. Recarga la página.', 409);
  }
  await recordB2bOrderEventSafe(doc.orderId, 'DOCUMENT_GENERATION_RETRIED', input.actor, {
    documentId: doc.id,
    type: doc.type,
    number: doc.number,
    attempt: doc.attempts + 1,
  });

  const fresh = await db.b2bDocument.findUniqueOrThrow({ where: { id: doc.id } });
  return renderAndStore(fresh, input.actor);
}

// ── Access & delivery ───────────────────────────────────────────────────────

/** Read the stored PDF of an ISSUED document. Callers MUST authorize first. */
export async function readIssuedDocumentPdf(doc: Pick<B2bDocument, 'status' | 'storageKey'>): Promise<Uint8Array> {
  if (doc.status !== 'ISSUED' || !doc.storageKey) {
    throw new B2bServiceError('El documento no está disponible.', 409);
  }
  return getB2bDocumentObject(doc.storageKey);
}

/** Email an ISSUED document to the customer and record the outcome in the audit trail. */
export async function emailB2bDocument(input: {
  orderId: string;
  documentId: string;
  actor: string;
  orderUrl: string;
  pdf?: Uint8Array | null;
}): Promise<{ sent: boolean; error: string | null }> {
  const doc = await db.b2bDocument.findFirst({
    where: { id: input.documentId, orderId: input.orderId },
    include: { order: { include: { customer: true } } },
  });
  if (!doc) throw new B2bServiceError('Documento no encontrado.', 404);
  if (doc.status !== 'ISSUED') throw new B2bServiceError('Solo se pueden enviar documentos emitidos.', 409);

  try {
    const pdf = input.pdf ?? (await readIssuedDocumentPdf(doc));
    await sendB2bDocumentEmail({
      to: doc.order.customer.email,
      contactName: doc.order.customer.contactName,
      orderNumber: doc.order.orderNumber,
      documentType: doc.type,
      documentNumber: doc.number,
      total: Number(doc.total),
      pdf,
      orderUrl: input.orderUrl,
    });
    await recordB2bOrderEventSafe(doc.orderId, 'DOCUMENT_EMAIL_SENT', input.actor, {
      documentId: doc.id,
      number: doc.number,
      to: doc.order.customer.email,
    });
    return { sent: true, error: null };
  } catch (err) {
    const error = `No se pudo enviar el email (${err instanceof Error ? err.name : 'Error'}).`;
    Sentry.captureException(err, {
      tags: { module: 'b2b', action: 'document_email' },
      extra: { documentId: doc.id, orderId: doc.orderId },
    });
    await recordB2bOrderEventSafe(doc.orderId, 'DOCUMENT_EMAIL_FAILED', input.actor, {
      documentId: doc.id,
      number: doc.number,
      error,
    });
    return { sent: false, error };
  }
}

/** HTTP response streaming an authorized document PDF. */
export function documentPdfResponse(number: string, pdf: Uint8Array, disposition: 'inline' | 'attachment'): Response {
  const safeName = number.replace(/[^A-Za-z0-9-]/g, '') || 'documento';
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${safeName}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
