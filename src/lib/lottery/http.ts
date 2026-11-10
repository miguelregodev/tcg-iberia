import { NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';
import { LotteryError } from './service';

/** Maps service errors to JSON responses; unexpected errors are reported to Sentry. */
export function lotteryErrorResponse(error: unknown, module: string, request: Request): NextResponse {
  if (error instanceof LotteryError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  captureServerError({ error, module, request });
  return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
}
