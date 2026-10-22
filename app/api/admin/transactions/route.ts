/**
 * Admin API — transactions, with filtering, pagination and period totals.
 *
 * Query params: client_id, price_id, status, gateway, payment_type, q (email or
 * name search), from, to (YYYY-MM-DD, inclusive, India time), limit, offset.
 *
 * Returns the requested page plus a `summary` over EVERY row matching the same
 * filters (not just this page), so the totals strip agrees with the table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { dayRangeToInstants } from '@/lib/date-range';

const MAX_LIMIT = 200;
const SUMMARY_LIMIT = 5000;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const supabase = getAdminSupabase();

  const limit = Math.min(Number(sp.get('limit')) || 50, MAX_LIMIT);
  const offset = Number(sp.get('offset')) || 0;

  const clientId = sp.get('client_id');
  const priceId = sp.get('price_id');
  const status = sp.get('status');
  const gateway = sp.get('gateway');
  const paymentType = sp.get('payment_type');
  const q = sp.get('q');
  const range = dayRangeToInstants(sp.get('from'), sp.get('to'));

  // One filter definition applied to both the page query and the summary
  // query, so they can never disagree about which rows are "in".
  const applyFilters = <T extends { eq: any; gte: any; lt: any; or: any }>(query: T): T => {
    let out: any = query;
    if (clientId) out = out.eq('client_id', clientId);
    if (priceId) out = out.eq('price_id', priceId);
    if (status) out = out.eq('status', status);
    if (gateway) out = out.eq('gateway', gateway);
    if (paymentType) out = out.eq('payment_type', paymentType);
    if (range.gte) out = out.gte('created_at', range.gte);
    if (range.lt) out = out.lt('created_at', range.lt);
    if (q) out = out.or(`customer_email.ilike.%${q}%,customer_name.ilike.%${q}%`);
    return out;
  };

  const pageQuery = applyFilters(
    supabase.from('transactions').select('*', { count: 'exact' })
  )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const summaryQuery = applyFilters(
    supabase.from('transactions').select('status, amount_paise, currency')
  )
    .order('created_at', { ascending: false })
    .limit(SUMMARY_LIMIT);

  const [pageRes, summaryRes] = await Promise.all([pageQuery, summaryQuery]);

  if (pageRes.error) return NextResponse.json({ error: pageRes.error.message }, { status: 500 });
  if (summaryRes.error) {
    return NextResponse.json({ error: summaryRes.error.message }, { status: 500 });
  }

  const summary = {
    count: 0,
    paid: 0,
    failed: 0,
    // Per currency: INR paise and AED fils cannot be added together.
    revenue: {} as Record<string, number>,
    truncated: (summaryRes.data ?? []).length >= SUMMARY_LIMIT,
  };

  for (const tx of summaryRes.data ?? []) {
    summary.count += 1;
    if (tx.status === 'paid') {
      summary.paid += 1;
      const cur = (tx.currency || 'INR').toUpperCase();
      summary.revenue[cur] = (summary.revenue[cur] ?? 0) + (tx.amount_paise ?? 0);
    } else if (tx.status === 'failed') {
      summary.failed += 1;
    }
  }

  return NextResponse.json({
    transactions: pageRes.data ?? [],
    total: pageRes.count ?? 0,
    summary,
    limit,
    offset,
  });
}
