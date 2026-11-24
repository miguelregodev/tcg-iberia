/**
 * Error type + route helper shared by the B2B order/document services.
 * Services throw `B2bServiceError` for expected business failures (404 / 409
 * / 422); anything else is treated as an unexpected 500 and sent to Sentry
 * without leaking internals to the client.
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export class B2bServiceError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409 | 422 = 409
  ) {
    super(message);
    this.name = 'B2bServiceError';
  }
}

export function b2bErrorResponse(
  err: unknown,
  action: string,
  extra?: Record<string, unknown>
): NextResponse {
  if (err instanceof B2bServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  Sentry.captureException(err, { tags: { module: 'b2b', action }, extra });
  return NextResponse.json(
    { error: 'Se ha producido un error inesperado. Inténtalo de nuevo.' },
    { status: 500 }
  );
}

/** Safely parse a JSON body; returns `{}` for empty/invalid bodies. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function optionalString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}
