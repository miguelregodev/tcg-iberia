/**
 * Private Cloudflare R2 storage for B2B documents (invoices, proformas,
 * quotations, corrective invoices).
 *
 * - Reuses the shared R2 client/credentials from `src/lib/r2.ts`.
 * - Uses a SEPARATE, PRIVATE bucket (`R2_B2B_INVOICES_BUCKET`, default
 *   `b2b-invoices`). The bucket must have no public access / custom domain:
 *   documents are only ever served through authorized API routes that stream
 *   the object after checking ownership. No public or presigned URL is ever
 *   built here, and storage keys never leave the server.
 */

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/r2';

export function getB2bDocumentsBucket(): string {
  const bucket = (process.env.R2_B2B_INVOICES_BUCKET || 'b2b-invoices').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('R2_B2B_INVOICES_BUCKET is not a valid bucket name.');
  }
  return bucket;
}

export async function putB2bDocumentObject(key: string, body: Uint8Array): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getB2bDocumentsBucket(),
      Key: key,
      Body: body,
      ContentType: 'application/pdf',
      CacheControl: 'private, no-store',
    })
  );
}

/** Returns the object size, or null when the object does not exist. */
export async function headB2bDocumentObject(key: string): Promise<{ size: number } | null> {
  try {
    const res = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getB2bDocumentsBucket(), Key: key })
    );
    return { size: res.ContentLength ?? 0 };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export async function getB2bDocumentObject(key: string): Promise<Uint8Array> {
  const res = await getR2Client().send(
    new GetObjectCommand({ Bucket: getB2bDocumentsBucket(), Key: key })
  );
  if (!res.Body) throw new Error('Empty R2 object body');
  return res.Body.transformToByteArray();
}
