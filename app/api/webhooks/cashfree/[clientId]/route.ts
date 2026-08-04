/**
 * Cashfree webhook receiver — POST /api/webhooks/cashfree/{clientId}
 *
 * Same per-tenant design as the Razorpay receiver: the client id is in the path
 * because we must know which secret to verify against before we can trust the
 * payload.
 *
 * SETUP PER CLIENT
 *   URL: https://<your-app>/api/webhooks/cashfree/<client_id>
 *   Configure in the client's Cashfree dashboard under Developers > Webhooks.
 *   Cashfree signs with the account's secret key; if you set a distinct webhook
 *   secret, save it in Admin > Clients and it will be preferred.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { verifyCashfreeWebhook } from '@/lib/webhooks/verify';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params;
  const supabase = getAdminSupabase();

  const rawBody = await request.text();
  const signature = request.headers.get('x-webhook-signature');
  const timestamp = request.headers.get('x-webhook-timestamp');

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, cashfree_secret_key, cashfree_webhook_secret')
    .eq('id', clientId)
    .single();

  if (clientError || !client) {
    console.error('[cashfree-webhook] unknown client:', clientId);
    return NextResponse.json({ error: 'unknown_client' }, { status: 404 });
  }

  // Cashfree signs with the account secret key unless a dedicated webhook
  // secret has been configured.
  const secret = client.cashfree_webhook_secret || client.cashfree_secret_key;

  if (!secret) {
    console.error('[cashfree-webhook] no secret configured for', clientId);
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 400 });
  }

  if (!verifyCashfreeWebhook(rawBody, signature, timestamp, secret)) {
    console.error('[cashfree-webhook] signature verification failed for', clientId);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const eventType: string = event.type || 'unknown';
  const order = event?.data?.order;
  const payment = event?.data?.payment;

  // Cashfree has no event-id header, so derive a stable key for dedupe.
  const eventId =
    payment?.cf_payment_id != null
      ? `${eventType}:${payment.cf_payment_id}`
      : order?.order_id
        ? `${eventType}:${order.order_id}`
        : null;

  if (eventId) {
    const { error: dupeError } = await supabase.from('webhook_events').insert({
      client_id: clientId,
      gateway: 'cashfree',
      event_id: eventId,
      event_type: eventType,
      payload: event,
    });

    if (dupeError) {
      if (dupeError.code === '23505') {
        return NextResponse.json({ status: 'already_processed' });
      }
      console.error('[cashfree-webhook] failed to log event:', dupeError);
    }
  }

  try {
    const status = payment?.payment_status;

    if (status) {
      const paid = status === 'SUCCESS';
      const orderId = order?.order_id;

      if (orderId) {
        await supabase
          .from('transactions')
          .update({
            gateway_payment_id: payment.cf_payment_id ? String(payment.cf_payment_id) : null,
            status: paid ? 'paid' : 'failed',
            paid_at: paid ? payment.payment_time ?? new Date().toISOString() : null,
            error_message: paid ? null : payment.payment_message ?? 'Payment failed',
            updated_at: new Date().toISOString(),
          })
          .eq('gateway', 'cashfree')
          .eq('gateway_order_id', orderId);
      }
    }

    if (eventId) {
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .eq('gateway', 'cashfree')
        .eq('event_id', eventId);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[cashfree-webhook] processing error:', error);

    if (eventId) {
      await supabase
        .from('webhook_events')
        .update({ processed: false, error: error.message })
        .eq('gateway', 'cashfree')
        .eq('event_id', eventId);
    }

    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
