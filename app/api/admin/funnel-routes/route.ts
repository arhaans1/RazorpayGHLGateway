/**
 * Admin API — funnel routes (hostname + path -> client + price + gateway).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Normalize hostname/path the same way /api/create-order does at lookup time,
 * otherwise a route saved as "https://site.com/" or "checkout" silently never
 * matches an incoming request.
 */
function normalizeRoute(payload: any) {
  const out = { ...payload };

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

  return out;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('funnel_routes')
    .select('*')
    .order('hostname', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = normalizeRoute(await request.json());

  if (!body.hostname || !body.path_prefix || !body.client_id || !body.price_id) {
    return NextResponse.json(
      { error: 'hostname, path_prefix, client_id and price_id are required' },
      { status: 400 }
    );
  }

  // The table has a UNIQUE(hostname, path_prefix) constraint; translate the raw
  // Postgres error into something an operator can act on.
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from('funnel_routes').insert(body).select().single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `A route for ${body.hostname}${body.path_prefix} already exists.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ route: data });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, ...rest } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('funnel_routes')
    .update(normalizeRoute(rest))
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Another route already uses that hostname and path.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ route: data });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminSupabase();
  const { error } = await supabase.from('funnel_routes').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
