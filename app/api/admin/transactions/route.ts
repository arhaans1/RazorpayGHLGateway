/**
 * Admin API — transactions, with filtering and pagination.
 *
 * Query params: client_id, price_id, status, gateway, payment_type, q (email or
 * name search), limit, offset.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const supabase = getAdminSupabase();

  const limit = Math.min(Number(sp.get('limit')) || 50, MAX_LIMIT);
  const offset = Number(sp.get('offset')) || 0;

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const clientId = sp.get('client_id');
  const priceId = sp.get('price_id');
  const status = sp.get('status');
  const gateway = sp.get('gateway');
  const paymentType = sp.get('payment_type');
  const q = sp.get('q');

  if (clientId) query = query.eq('client_id', clientId);
  if (priceId) query = query.eq('price_id', priceId);
  if (status) query = query.eq('status', status);
  if (gateway) query = query.eq('gateway', gateway);
  if (paymentType) query = query.eq('payment_type', paymentType);
  if (q) query = query.or(`customer_email.ilike.%${q}%,customer_name.ilike.%${q}%`);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    transactions: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
