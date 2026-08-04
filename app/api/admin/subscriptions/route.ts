/**
 * Admin API — subscriptions list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const supabase = getAdminSupabase();

  const limit = Math.min(Number(sp.get('limit')) || 100, 200);

  let query = supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  const clientId = sp.get('client_id');
  const status = sp.get('status');

  if (clientId) query = query.eq('client_id', clientId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ subscriptions: data ?? [] });
}
