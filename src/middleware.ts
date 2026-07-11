/**
 * Middleware — currently a pass-through.
 *
 * B2B route restrictions have been removed: B2B users can browse the full
 * site freely. The ProductListPage filters catalog content to only show
 * products with active B2B tariffs. Logout only happens when the user
 * explicitly clicks "Cerrar sesión B2B".
 *
 * NOTE: The Edge runtime cannot use Prisma or Node.js-only modules.
 * Session validity is verified by server layouts and API routes.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
