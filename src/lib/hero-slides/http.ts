import { NextResponse } from 'next/server';
import { captureServerError } from '@/lib/observability/sentry';
import { HeroSlideNotFoundError, HeroSlideValidationError } from './service';

/** Maps service errors to JSON responses. Unknown errors are reported to Sentry and return 500. */
export function heroSlideErrorResponse(error: unknown, module: string, request: Request): NextResponse {
  if (error instanceof HeroSlideNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof HeroSlideValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error(`${module} error:`, error);
  captureServerError({ error, module, request });
  return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
}

export const UNAUTHORIZED_RESPONSE = { error: 'Unauthorized' } as const;
