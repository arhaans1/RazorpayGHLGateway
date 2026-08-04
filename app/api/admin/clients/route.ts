/**
 * Admin API — clients.
 *
 * Payment credentials never leave the server in full: secrets are returned as
 * booleans ("is a secret set?") so the admin UI can show state without shipping
 * the actual keys to the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin-auth';

const SECRET_FIELDS = [
  'razorpay_key_secret',
  'cashfree_secret_key',
  'razorpay_webhook_secret',
  'cashfree_webhook_secret',
] as const;

/** Placeholder the UI renders for an already-saved secret. */
const MASK = '********';

function redact(row: any) {
  const out: any = { ...row };
  for (const field of SECRET_FIELDS) {
    out[`has_${field}`] = Boolean(row[field]);
    delete out[field];
  }
  return out;
}

/**
 * Strip untouched secret fields so an edit that leaves them masked doesn't
 * overwrite the stored value with the mask itself.
 */
function cleanSecrets(payload: any) {
  const out = { ...payload };
  for (const field of SECRET_FIELDS) {
    const value = out[field];
    if (value === undefined || value === MASK || value === '') {
      delete out[field];
    }
  }
  return out;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clients: (data ?? []).map(redact) });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json();
  if (!body.id || !body.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('clients')
    .insert(cleanSecrets(body))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ client: redact(data) });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('clients')
    .update(cleanSecrets(updates))
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ client: redact(data) });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = getAdminSupabase();
  const { error } = await supabase.from('clients').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
