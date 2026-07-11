/**
 * Shared admin auth helper for the B2B routes.
 *
 * Keeps every /api/admin/b2b/** endpoint aligned with the existing admin
 * cookie-based auth used by the rest of the admin panel.
 */

import type { NextRequest } from 'next/server';

export function isAdminAuthenticated(request: NextRequest): boolean {
  return !!request.cookies.get('tcg_admin_auth');
}
