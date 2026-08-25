/**
 * Admin API — prices (products).
 *
 * A price is either one-time or a subscription. Subscription prices additionally
 * carry a Razorpay plan id, created via /api/admin/prices/create-plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { RAZORPAY_HIDEABLE_METHODS } from '@/lib/payment-providers/razorpay-methods';
import { normalizeRoute, describeRouteConflict, RouteInput } from '@/lib/funnel-routes';
import type { SupabaseClient } from '@supabase/supabase-js';

const BILLING_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

/**
 * Create, update or clear a product's checkout URL.
 *
 * A product is sold on exactly one URL, so the Products page edits a single
 * route. The underlying table still allows several per product (nothing but
 * this UI enforces one), so we always operate on the OLDEST route and leave any
 * extras alone rather than silently deleting rows this screen never showed.
 *
 * Returns an error string, or null on success. Runs after the price write so
 * the foreign key target exists.
 */
async function applyRoute(
  supabase: SupabaseClient,
  priceId: string,
  clientId: string,
  input: RouteInput
): Promise<string | null> {
  const route = normalizeRoute(input);
  const hostname = (route.hostname || '').trim();
  const pathPrefix = (route.path_prefix || '').trim();

  const { data: existing } = await supabase
    .from('funnel_routes')
    .select('id')
    .eq('price_id', priceId)
    .order('id', { ascending: true });

  const primary = existing?.[0];

  // Both fields blank means "take this product offline". Only the primary route
  // is removed; extras stay until they are dealt with explicitly.
  if (!hostname || !pathPrefix) {
    if (primary) {
      const { error } = await supabase.from('funnel_routes').delete().eq('id', primary.id);
      if (error) return error.message;
    }
    return null;
  }

  const row = {
    hostname,
    path_prefix: pathPrefix,
    client_id: clientId,
    price_id: priceId,
    gateway: route.gateway || 'razorpay',
    is_active: route.is_active !== false,
  };

  const { error } = primary
    ? await supabase.from('funnel_routes').update(row).eq('id', primary.id)
    : await supabase.from('funnel_routes').insert(row);

  if (error) {
    if (error.code === '23505') {
      return await describeRouteConflict(supabase, hostname, pathPrefix);
    }
    return error.message;
  }

  return null;
}

/**
 * Reject junk before it reaches the database or a live Razorpay checkout config.
 * Throws; POST and PATCH both funnel thrown errors into a 400.
 */
function sanitizeHiddenMethods(value: any): string[] {
  if (value == null) return [];

  if (!Array.isArray(value)) {
    throw new Error('hidden_payment_methods must be an array of method keys');
  }

  const cleaned = Array.from(
    new Set(value.map((v: any) => String(v).trim().toLowerCase()).filter(Boolean))
  );

  const invalid = cleaned.filter((m) => !RAZORPAY_HIDEABLE_METHODS.includes(m));
  if (invalid.length) {
    throw new Error(
      `Unknown payment method(s): ${invalid.join(', ')}. ` +
        `Allowed: ${RAZORPAY_HIDEABLE_METHODS.join(', ')}`
    );
  }

  return cleaned;
}

/**
 * Normalize the recurring fields so a one-time price never carries stale
 * subscription config left over from a previous edit.
 */
function normalize(payload: any) {
  const out = { ...payload };

  // Applies to BOTH payment types, so it is handled before the one-time early
  // return below and must not be nulled there.
  //
  // Only touched when the caller actually sent it. Supabase .update() leaves
  // absent keys alone, so normalizing an absent field into [] would silently
  // wipe an operator's saved list on any partial PATCH.
  if ('hidden_payment_methods' in out) {
    out.hidden_payment_methods = sanitizeHiddenMethods(out.hidden_payment_methods);
  }

  if (out.payment_type !== 'subscription') {
    out.payment_type = 'one_time';
    out.billing_period = null;
    out.billing_interval = null;
    out.total_count = null;
    out.razorpay_plan_id = null;
    return out;
  }

  if (!BILLING_PERIODS.includes(out.billing_period)) {
    throw new Error(`billing_period must be one of: ${BILLING_PERIODS.join(', ')}`);
  }

  out.billing_interval = Number(out.billing_interval) || 1;
  out.total_count = out.total_count ? Number(out.total_count) : null;

  return out;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('prices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    // `route` is the product's checkout URL, saved alongside it so a new product
    // goes live in one step instead of needing a second trip to another screen.
    const { route, ...priceFields } = await request.json();
    const body = normalize(priceFields);

    if (!body.id || !body.client_id || !body.product_name) {
      return NextResponse.json(
        { error: 'id, client_id and product_name are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('prices').insert(body).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (route) {
      const routeError = await applyRoute(supabase, data.id, data.client_id, route);
      if (routeError) {
        // The product exists but is not reachable. Say so plainly rather than
        // reporting a clean save that silently sells nothing.
        return NextResponse.json(
          { error: `Product saved, but its checkout URL was not: ${routeError}`, price: data },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ price: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id, route, ...rest } = await request.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const supabase = getAdminSupabase();

    // Razorpay plans are immutable. If the amount or billing cycle changed, the
    // stored plan no longer matches the price, so drop it and force a re-create.
    const { data: existing } = await supabase
      .from('prices')
      .select('amount_paise, billing_period, billing_interval, currency')
      .eq('id', id)
      .single();

    const updates = normalize(rest);

    if (existing && updates.payment_type === 'subscription' && updates.razorpay_plan_id) {
      const planChanged =
        Number(existing.amount_paise) !== Number(updates.amount_paise) ||
        existing.billing_period !== updates.billing_period ||
        Number(existing.billing_interval) !== Number(updates.billing_interval) ||
        existing.currency !== updates.currency;

      if (planChanged) updates.razorpay_plan_id = null;
    }

    const { data, error } = await supabase
      .from('prices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (route) {
      const routeError = await applyRoute(supabase, data.id, data.client_id, route);
      if (routeError) {
        return NextResponse.json(
          { error: `Product saved, but its checkout URL was not: ${routeError}`, price: data },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ price: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminSupabase();
  const { error } = await supabase.from('prices').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
