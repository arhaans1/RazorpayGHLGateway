/**
 * Webhook signature verification.
 *
 * Webhooks are unauthenticated HTTP from the public internet — anyone can POST
 * to these endpoints claiming a payment succeeded. The signature is the ONLY
 * thing that makes them trustworthy, so verification must happen against the
 * exact raw body bytes before any parsing.
 */

import crypto from 'crypto';

/**
 * Constant-time comparison. A plain `===` on a signature leaks timing
 * information that can be used to forge one byte at a time.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Razorpay webhooks: hex HMAC-SHA256 of the raw body, keyed with the webhook
 * secret configured in that client's Razorpay dashboard.
 * Sent in the `x-razorpay-signature` header.
 */
export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  return safeEqual(expected, signature);
}

/**
 * Cashfree webhooks: base64 HMAC-SHA256 of (timestamp + rawBody), keyed with
 * the client's secret key. Sent in `x-webhook-signature` with the timestamp in
 * `x-webhook-timestamp`.
 */
export function verifyCashfreeWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature || !timestamp || !secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + rawBody)
    .digest('base64');

  return safeEqual(expected, signature);
}

/**
 * Razorpay checkout-handler signature (returned in the browser, not a webhook).
 *
 * NOTE the operand order differs between the two flows — a classic footgun:
 *   one-time:     HMAC(order_id + '|' + payment_id)
 *   subscription: HMAC(payment_id + '|' + subscription_id)
 */
export function verifyRazorpayOrderSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

export function verifyRazorpaySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  keySecret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}
