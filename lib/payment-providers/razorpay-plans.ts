/**
 * Razorpay Plans API.
 *
 * A plan is a reusable template (amount + billing cycle) that a subscription
 * points at. Plans live inside the CLIENT's own Razorpay account, so a plan
 * created for one client is meaningless to another — hence plan ids are stored
 * per price and created with that client's credentials.
 *
 * Plans are immutable in Razorpay: changing the amount or cycle of an existing
 * plan is not possible, you create a new one. createRazorpayPlan() is therefore
 * called again whenever a subscription price's amount/period changes.
 */

import { Client, BillingPeriod, PaymentProviderError } from './types';
import { RAZORPAY_API_BASE, razorpayAuthHeader } from './razorpay';

export interface CreatePlanParams {
  client: Client;
  productName: string;
  amountPaise: number;
  currency: string;
  period: BillingPeriod;
  interval: number;
}

export const BILLING_PERIODS: BillingPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

export async function createRazorpayPlan(params: CreatePlanParams): Promise<string> {
  const { client, productName, amountPaise, currency, period, interval } = params;

  if (!client.razorpay_key_id || !client.razorpay_key_secret) {
    throw new PaymentProviderError(
      'razorpay',
      400,
      { error: 'missing_credentials' },
      'Razorpay credentials not configured for this client'
    );
  }

  if (!BILLING_PERIODS.includes(period)) {
    throw new PaymentProviderError(
      'razorpay',
      400,
      { error: 'invalid_period' },
      `Billing period must be one of: ${BILLING_PERIODS.join(', ')}`
    );
  }

  const formData = new URLSearchParams({
    period,
    interval: String(interval || 1),
    'item[name]': productName,
    'item[amount]': String(amountPaise),
    'item[currency]': currency.toUpperCase(),
    'item[description]': productName,
  });

  const response = await fetch(`${RAZORPAY_API_BASE}/plans`, {
    method: 'POST',
    headers: {
      Authorization: razorpayAuthHeader(client),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.id) {
    const detail = data?.error?.description || data?.error?.reason || JSON.stringify(data);
    throw new PaymentProviderError(
      'razorpay',
      response.status || 500,
      data,
      `Failed to create Razorpay plan: ${detail}`
    );
  }

  return data.id as string;
}
