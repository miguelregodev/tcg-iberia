/**
 * POST /api/b2b/logout
 *
 * Deletes the current B2B session row and clears the cookie. Safe to call
 * even when no active session exists (always returns 200).
 */

import { NextRequest, NextResponse } from 'next/server';
import { destroyB2bSession } from '@/lib/b2b/session';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  await destroyB2bSession(request, response);
  return response;
}
