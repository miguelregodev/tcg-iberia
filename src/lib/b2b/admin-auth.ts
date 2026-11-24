/**
 * Shared admin auth helper for the B2B routes.
 *
 * Keeps every /api/admin/b2b/** endpoint aligned with the existing admin
 * cookie-based auth used by the rest of the admin panel.
 */

import type { NextRequest } from 'next/server';
import { isAdminAuthenticated as verifyAdminSession } from '@/lib/admin-auth';

export function isAdminAuthenticated(request: NextRequest): boolean {
  return verifyAdminSession(request);
}

/**
 * Audit identity for admin actions. The admin panel uses a single shared
 * password (no per-user accounts), so the configured ADMIN_EMAIL is recorded
 * — the same identity already stored in `B2bRequest.reviewedByEmail`.
 */
export function getAdminActor(): string {
  const email = (process.env.ADMIN_EMAIL || 'admin@tcgiberia.com').trim().toLowerCase();
  return `admin:${email}`;
}
