/**
 * Admin API — dashboard aggregates.
 *
 * Aggregation happens in JS rather than SQL because supabase-js has no GROUP BY;
 * we pull a bounded slice of lightweight columns and fold it. If transaction
 * volume outgrows AGGREGATE_LIMIT, replace this with a Postgres view or RPC.
 */

import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

const AGGREGATE_LIMIT = 5000;

interface Bucket {
  count: number;
  paid: number;
  failed: number;
  revenue_paise: number;
}

const emptyBucket = (): Bucket => ({ count: 0, paid: 0, failed: 0, revenue_paise: 0 });

function fold(bucket: Bucket, status: string, amount: number) {
  bucket.count += 1;
  if (status === 'paid') {
    bucket.paid += 1;
    bucket.revenue_paise += amount;
  } else if (status === 'failed') {
    bucket.failed += 1;
  }
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = getAdminSupabase();

  const [clientsRes, pricesRes, routesRes, txRes, subsRes] = await Promise.all([
    supabase.from('clients').select('id, name'),
    supabase.from('prices').select('id, client_id, product_name, payment_type, amount_paise'),
    supabase.from('funnel_routes').select('id, is_active'),
    supabase
      .from('transactions')
      .select('client_id, price_id, status, amount_paise, payment_type, gateway, created_at')
      .order('created_at', { ascending: false })
      .limit(AGGREGATE_LIMIT),
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

  // Last 30 days, computed once outside the loop.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = emptyBucket();

  for (const tx of transactions) {
    const amount = tx.amount_paise ?? 0;

    fold(totals, tx.status, amount);

    if (tx.client_id) {
      if (!byClient.has(tx.client_id)) byClient.set(tx.client_id, emptyBucket());
      fold(byClient.get(tx.client_id)!, tx.status, amount);
    }

    if (tx.price_id) {
      if (!byPrice.has(tx.price_id)) byPrice.set(tx.price_id, emptyBucket());
      fold(byPrice.get(tx.price_id)!, tx.status, amount);
    }

    if (tx.created_at && new Date(tx.created_at).getTime() >= cutoff) {
      fold(recent, tx.status, amount);
    }
  }

  const activeSubscriptions = subscriptions.filter((s) =>
    ['active', 'authenticated', 'pending'].includes(s.status)
  ).length;

  return NextResponse.json({
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
    last_30_days: recent,
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
      ...(byPrice.get(p.id) ?? emptyBucket()),
    })),
  });
}
