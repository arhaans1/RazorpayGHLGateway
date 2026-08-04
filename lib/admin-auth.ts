/**
 * Shared guard for /api/admin/* routes.
 *
 * The admin area uses a single shared password that sets an httpOnly
 * `admin_auth` cookie. Every admin API route must call requireAdmin() before
 * touching the service-role Supabase client.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

/**
 * Returns a 401 response if the caller is not authenticated, otherwise null.
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
