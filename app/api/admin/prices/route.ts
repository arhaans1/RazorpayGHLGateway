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

const BILLING_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];

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
    const body = normalize(await request.json());

    if (!body.id || !body.client_id || !body.product_name) {
      return NextResponse.json(
        { error: 'id, client_id and product_name are required' },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();
    const { data, error } = await supabase.from('prices').insert(body).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ price: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id, ...rest } = await request.json();
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
