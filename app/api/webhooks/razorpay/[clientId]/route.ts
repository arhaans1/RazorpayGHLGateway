/**
 * Razorpay webhook receiver — POST /api/webhooks/razorpay/{clientId}
 *
 * WHY THE CLIENT ID IS IN THE PATH
 *   Every tenant has their own Razorpay account and therefore their own webhook
 *   secret. A webhook payload does not identify the tenant, and we cannot verify
 *   a signature without first knowing which secret to use — so the tenant is
 *   carried in the URL. Each client pastes their own URL into their own Razorpay
 *   dashboard (Settings > Webhooks).
 *
 * SETUP PER CLIENT
 *   URL:    https://<your-app>/api/webhooks/razorpay/<client_id>
 *   Secret: any random string, saved both in Razorpay and in Admin > Clients
 *   Events: payment.captured, payment.failed,
 *           subscription.activated, subscription.charged, subscription.halted,
 *           subscription.cancelled, subscription.completed, subscription.pending
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { verifyRazorpayWebhook } from '@/lib/webhooks/verify';

/** Razorpay subscription status -> our stored status. Kept 1:1 for clarity. */
const SUBSCRIPTION_EVENT_STATUS: Record<string, string> = {
  'subscription.authenticated': 'authenticated',
  'subscription.activated': 'active',
  'subscription.charged': 'active',
  'subscription.pending': 'pending',
  'subscription.halted': 'halted',
  'subscription.cancelled': 'cancelled',
  'subscription.completed': 'completed',
  'subscription.expired': 'expired',
};

function toTimestamp(unixSeconds: unknown): string | null {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const supabase = getAdminSupabase();

  // Read the RAW body. Parsing first and re-serializing would change the bytes
  // and break the signature.
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const eventId = request.headers.get('x-razorpay-event-id');

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, razorpay_webhook_secret')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    console.error('[razorpay-webhook] unknown client:', clientId);
    return NextResponse.json({ error: 'unknown_client' }, { status: 404 });
  }

  if (!client.razorpay_webhook_secret) {
    console.error('[razorpay-webhook] no webhook secret configured for', clientId);
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 400 });
  }

  if (!verifyRazorpayWebhook(rawBody, signature, client.razorpay_webhook_secret)) {
    console.error('[razorpay-webhook] signature verification failed for', clientId);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const eventType: string = event.event || 'unknown';

  // Idempotency: Razorpay retries on any non-2xx, so the same event can arrive
  // repeatedly. The unique index on (gateway, event_id) makes the second insert
  // fail, which is our signal to stop and ack.
  if (eventId) {
    const { error: dupeError } = await supabase.from('webhook_events').insert({
      client_id: clientId,
      gateway: 'razorpay',
      event_id: eventId,
      event_type: eventType,
      payload: event,
    });

    if (dupeError) {
      if (dupeError.code === '23505') {
        return NextResponse.json({ status: 'already_processed' });
      }
      console.error('[razorpay-webhook] failed to log event:', dupeError);
    }
  }

  try {
    if (eventType.startsWith('subscription.')) {
      await handleSubscriptionEvent(supabase, clientId, eventType, event);
    } else if (eventType.startsWith('payment.')) {
      await handlePaymentEvent(supabase, clientId, eventType, event);
    }

    if (eventId) {
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('gateway', 'razorpay')
        .eq('event_id', eventId);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[razorpay-webhook] processing error:', error);

    if (eventId) {
      await supabase
        .from('webhook_events')
        .update({ processed: false, error: error.message })
        .eq('gateway', 'razorpay')
        .eq('event_id', eventId);
    }

    // 500 tells Razorpay to retry — correct, since our own processing failed.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// payment.captured / payment.failed  (one-time payments)
// ---------------------------------------------------------------------------
async function handlePaymentEvent(
  supabase: ReturnType<typeof getAdminSupabase>,
  clientId: string,
  eventType: string,
  event: any
) {
  const payment = event?.payload?.payment?.entity;
  if (!payment) return;

  const orderId: string | undefined = payment.order_id;
  const paid = eventType === 'payment.captured';

  const update = {
    gateway_payment_id: payment.id,
    status: paid ? 'paid' : 'failed',
    paid_at: paid ? toTimestamp(payment.created_at) ?? new Date().toISOString() : null,
    error_message: paid ? null : payment.error_description || 'Payment failed',
    updated_at: new Date().toISOString(),
  };

  if (orderId) {
    const { data: updated } = await supabase
      .from('transactions')
      .update(update)
      .eq('gateway', 'razorpay')
      .eq('gateway_order_id', orderId)
      .select('id');

    // A subscription's first charge arrives as payment.captured with an order_id
    // we never recorded. Fall through to the insert below rather than losing it.
    if (updated && updated.length > 0) return;
  }

  await supabase.from('transactions').insert({
    client_id: clientId,
    price_id: payment.notes?.price_id ?? null,
    gateway: 'razorpay',
    payment_type: 'one_time',
    gateway_order_id: orderId ?? null,
    gateway_payment_id: payment.id,
    status: paid ? 'paid' : 'failed',
    amount_paise: payment.amount ?? 0,
    currency: payment.currency ?? 'INR',
    customer_name: payment.notes?.name ?? null,
    customer_email: payment.email ?? payment.notes?.email ?? null,
    customer_contact: payment.contact ?? payment.notes?.contact ?? null,
    product_name: payment.notes?.product_name ?? null,
    paid_at: paid ? toTimestamp(payment.created_at) : null,
    error_message: paid ? null : payment.error_description ?? null,
  });
}

// ---------------------------------------------------------------------------
// subscription.*  (recurring)
// ---------------------------------------------------------------------------
async function handleSubscriptionEvent(
  supabase: ReturnType<typeof getAdminSupabase>,
  clientId: string,
  eventType: string,
  event: any
) {
  const sub = event?.payload?.subscription?.entity;
  if (!sub) return;

  const status = SUBSCRIPTION_EVENT_STATUS[eventType] ?? sub.status ?? 'created';

  await supabase.from('subscriptions').upsert(
    {
      client_id: clientId,
      price_id: sub.notes?.price_id ?? null,
      gateway: 'razorpay',
      gateway_subscription_id: sub.id,
      gateway_plan_id: sub.plan_id ?? null,
      status,
      customer_name: sub.notes?.name ?? null,
      customer_email: sub.notes?.email ?? null,
      customer_contact: sub.notes?.contact ?? null,
      product_name: sub.notes?.product_name ?? null,
      total_count: sub.total_count ?? null,
      paid_count: sub.paid_count ?? 0,
      current_start: toTimestamp(sub.current_start),
      current_end: toTimestamp(sub.current_end),
      charge_at: toTimestamp(sub.charge_at),
      ended_at: toTimestamp(sub.ended_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'gateway,gateway_subscription_id' }
  );

  // Each successful renewal is its own transaction row, so revenue reporting
  // counts every cycle rather than just the initial signup.
  if (eventType === 'subscription.charged') {
    const payment = event?.payload?.payment?.entity;
    if (!payment) return;

    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('gateway', 'razorpay')
      .eq('gateway_payment_id', payment.id)
      .maybeSingle();

    if (existing) return;

    await supabase.from('transactions').insert({
      client_id: clientId,
      price_id: sub.notes?.price_id ?? null,
      gateway: 'razorpay',
      payment_type: 'subscription',
      gateway_order_id: payment.order_id ?? null,
      gateway_payment_id: payment.id,
      gateway_subscription_id: sub.id,
      status: 'paid',
      amount_paise: payment.amount ?? 0,
      currency: payment.currency ?? 'INR',
      customer_name: sub.notes?.name ?? null,
      customer_email: payment.email ?? sub.notes?.email ?? null,
      customer_contact: payment.contact ?? sub.notes?.contact ?? null,
      product_name: sub.notes?.product_name ?? null,
      paid_at: toTimestamp(payment.created_at) ?? new Date().toISOString(),
    });
  }
}
