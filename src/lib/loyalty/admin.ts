import type { NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { getAdminActor } from '@/lib/b2b/admin-auth';

export function getLoyaltyAdministrator(request: NextRequest): string | null {
  return isAdminAuthenticated(request) ? getAdminActor() : null;
}
