/**
 * Admin API — dashboard aggregates for a date range.
 *
 * Query params: from, to (YYYY-MM-DD, inclusive, India time). Either may be
 * omitted for an open-ended range; both omitted means all time.
 *
 * Aggregation happens in JS rather than SQL because supabase-js has no GROUP BY;
 * we pull a bounded slice of lightweight columns and fold it. If transaction
 * volume outgrows AGGREGATE_LIMIT, replace this with a Postgres view or RPC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';
import { dayRangeToInstants } from '@/lib/date-range';

const AGGREGATE_LIMIT = 5000;

interface Bucket {
  count: number;
  paid: number;
  failed: number;
  /**
   * Revenue in minor units, keyed by currency. Kept separate per currency
   * because adding AED fils to INR paise produces a number that means nothing.
   */
  revenue: Record<string, number>;
}

const emptyBucket = (): Bucket => ({ count: 0, paid: 0, failed: 0, revenue: {} });

function fold(bucket: Bucket, status: string, amount: number, currency: string) {
  bucket.count += 1;
  if (status === 'paid') {
    bucket.paid += 1;
    bucket.revenue[currency] = (bucket.revenue[currency] ?? 0) + amount;
  } else if (status === 'failed') {
    bucket.failed += 1;
  }
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const range = dayRangeToInstants(sp.get('from'), sp.get('to'));

  const supabase = getAdminSupabase();

  let txQuery = supabase
    .from('transactions')
    .select('client_id, price_id, status, amount_paise, currency, created_at')
    .order('created_at', { ascending: false })
    .limit(AGGREGATE_LIMIT);

  if (range.gte) txQuery = txQuery.gte('created_at', range.gte);
  if (range.lt) txQuery = txQuery.lt('created_at', range.lt);

  // Clients, products, routes and subscriptions describe the current setup,
  // not activity, so they are deliberately NOT filtered by the date range.
  const [clientsRes, pricesRes, routesRes, txRes, subsRes] = await Promise.all([
    supabase.from('clients').select('id, name'),
    supabase.from('prices').select('id, client_id, product_name, payment_type, amount_paise, currency'),
    supabase.from('funnel_routes').select('id, is_active'),
    txQuery,
    supabase.from('subscriptions').select('client_id, status'),
  ]);

  const firstError =
    clientsRes.error || pricesRes.error || routesRes.error || txRes.error || subsRes.error;

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const clients = clientsRes.data ?? [];
  const prices = pricesRes.data ?? [];
  const routes = routesRes.data ?? [];
  const transactions = txRes.data ?? [];
  const subscriptions = subsRes.data ?? [];

  const byClient = new Map<string, Bucket>();
  const byPrice = new Map<string, Bucket>();
  const totals = emptyBucket();

  for (const tx of transactions) {
    const amount = tx.amount_paise ?? 0;
    const currency = (tx.currency || 'INR').toUpperCase();

    fold(totals, tx.status, amount, currency);

    if (tx.client_id) {
      if (!byClient.has(tx.client_id)) byClient.set(tx.client_id, emptyBucket());
      fold(byClient.get(tx.client_id)!, tx.status, amount, currency);
    }

    if (tx.price_id) {
      if (!byPrice.has(tx.price_id)) byPrice.set(tx.price_id, emptyBucket());
      fold(byPrice.get(tx.price_id)!, tx.status, amount, currency);
    }
  }

  const activeSubscriptions = subscriptions.filter((s) =>
    ['active', 'authenticated', 'pending'].includes(s.status)
  ).length;

  return NextResponse.json({
    range: { from: sp.get('from') || '', to: sp.get('to') || '' },
    totals: {
      ...totals,
      clients: clients.length,
      products: prices.length,
      routes: routes.length,
      active_routes: routes.filter((r) => r.is_active).length,
      subscriptions: subscriptions.length,
      active_subscriptions: activeSubscriptions,
      truncated: transactions.length >= AGGREGATE_LIMIT,
    },
    by_client: clients.map((c) => ({
      client_id: c.id,
      name: c.name,
      ...(byClient.get(c.id) ?? emptyBucket()),
    })),
    by_price: prices.map((p) => ({
      price_id: p.id,
      client_id: p.client_id,
      product_name: p.product_name,
      payment_type: p.payment_type ?? 'one_time',
      amount_paise: p.amount_paise,
      currency: p.currency ?? 'INR',
      ...(byPrice.get(p.id) ?? emptyBucket()),
    })),
  });
}
