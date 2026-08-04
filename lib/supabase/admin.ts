/**
 * Server-side Supabase client (service role).
 *
 * This key bypasses RLS, so it must NEVER be imported into a 'use client'
 * component. Every admin read/write now goes through /api/admin/* routes that
 * use this client, instead of the browser talking to Supabase with the public
 * anon key — which would otherwise expose client payment credentials to anyone
 * who opened devtools.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
