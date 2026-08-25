/**
 * Shared funnel-route helpers.
 *
 * Routes are now edited from two places — the Products page (each product's
 * single checkout URL) and the funnel-routes admin API — so the normalisation
 * lives here rather than in either route handler. If the two ever drifted, a
 * route saved from one screen could silently never match an incoming request.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RouteInput {
  hostname?: string;
  path_prefix?: string;
  gateway?: string;
  is_active?: boolean;
}

/**
 * Normalise hostname/path exactly the way /api/create-order does at lookup
 * time. A route stored as "https://site.com/" or "checkout" would otherwise
 * never match.
 */
export function normalizeRoute<T extends Record<string, any>>(payload: T): T {
  const out: Record<string, any> = { ...payload };

  if (typeof out.hostname === 'string') {
    out.hostname = out.hostname
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }

  if (typeof out.path_prefix === 'string') {
    let path = out.path_prefix.trim();
    if (!path.startsWith('/')) path = '/' + path;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    out.path_prefix = path;
  }

  return out as T;
}

/**
 * Turn a UNIQUE(hostname, path_prefix) violation into something actionable by
 * naming the product that already owns the URL. Falls back to a plain message
 * if the lookup fails — this runs on an error path and must not throw.
 */
export async function describeRouteConflict(
  supabase: SupabaseClient,
  hostname: string,
  pathPrefix: string
): Promise<string> {
  const url = `${hostname}${pathPrefix}`;

  try {
    const { data: clash } = await supabase
      .from('funnel_routes')
      .select('price_id')
      .eq('hostname', hostname)
      .eq('path_prefix', pathPrefix)
      .maybeSingle();

    if (clash?.price_id) {
      const { data: owner } = await supabase
        .from('prices')
        .select('product_name')
        .eq('id', clash.price_id)
        .maybeSingle();

      if (owner?.product_name) {
        return `${url} is already the checkout URL for "${owner.product_name}". Each URL can only sell one product.`;
      }
    }
  } catch {
    // fall through to the generic message
  }

  return `${url} is already used by another product. Each URL can only sell one product.`;
}
