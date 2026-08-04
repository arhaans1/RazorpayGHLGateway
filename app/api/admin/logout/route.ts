import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Sign out. POST only, deliberately.
 *
 * This was previously a GET handler linked from the nav with next/link. In a
 * production build Next.js prefetches links as they enter the viewport, so the
 * always-visible "Sign out" link was fetched automatically on every page load
 * and silently destroyed the session — every subsequent /api/admin/* call then
 * returned 401 while the page itself still rendered.
 *
 * Destroying a session is not a safe operation, so it must not be reachable by
 * GET. Anything may issue a GET: link prefetchers, crawlers, link previews,
 * browser preloading. Keeping this POST-only makes the class of bug impossible
 * rather than relying on a prefetch={false} opt-out at every call site.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_auth');
  return NextResponse.json({ success: true });
}
