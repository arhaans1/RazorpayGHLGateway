/**
 * Razorpay Payment Provider
 *
 * Handles both payment models:
 *   one_time     -> POST /v1/orders        -> checkout receives { order_id }
 *   subscription -> POST /v1/subscriptions -> checkout receives { subscription_id }
 *
 * Subscriptions require a plan to exist first. Plans are created per-price via
 * the admin API (see lib/payment-providers/razorpay-plans.ts) and their id is
 * stored on prices.razorpay_plan_id, because each client has their own Razorpay
 * account and plans are account-scoped.
 */

import {
  PaymentProvider,
  PaymentProviderResponse,
  PaymentProviderParams,
  PaymentProviderError,
  Client,
} from './types';

export const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/** Razorpay authenticates with HTTP Basic using key_id:key_secret. */
export function razorpayAuthHeader(client: Client): string {
  return (
    'Basic ' +
    Buffer.from(`${client.razorpay_key_id}:${client.razorpay_key_secret}`).toString('base64')
  );
}

function assertCredentials(client: Client) {
  if (!client.razorpay_key_id || !client.razorpay_key_secret) {
    throw new PaymentProviderError(
      'razorpay',
      400,
      { error: 'missing_credentials' },
      'Razorpay credentials not configured for this client'
    );
  }
}

function razorpayError(status: number, data: any, fallback: string): PaymentProviderError {
  const detail = data?.error?.description || data?.error?.reason || JSON.stringify(data);
  return new PaymentProviderError('razorpay', status || 500, data, `${fallback}: ${detail}`);
}

export class RazorpayProvider implements PaymentProvider {
  async createOrder(params: PaymentProviderParams): Promise<PaymentProviderResponse> {
    const { price } = params;
    assertCredentials(params.client);

    return price.payment_type === 'subscription'
      ? this.createSubscription(params)
      : this.createOneTimeOrder(params);
  }

  // -------------------------------------------------------------------------
  // One-time: Orders API
  // -------------------------------------------------------------------------
  private async createOneTimeOrder(
    params: PaymentProviderParams
  ): Promise<PaymentProviderResponse> {
    const { client, price, customer } = params;

    const receiptId = `rcpt_${Date.now()}`;
    const contactDigits = customer.contact.replace(/\D/g, '');

    const formData = new URLSearchParams({
      amount: price.amount_paise.toString(),
      currency: price.currency.toUpperCase(),
      receipt: receiptId,
      payment_capture: '1',
      'notes[name]': customer.name,
      'notes[email]': customer.email,
      'notes[contact]': contactDigits,
      'notes[product_name]': price.product_name,
      'notes[price_id]': price.id,
    });

    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthHeader(client),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      throw razorpayError(response.status, data, 'Razorpay API error');
    }

    return {
      gateway: 'razorpay',
      payment_type: 'one_time',
      order_id: data.id,
      checkout_data: {
        key: client.razorpay_key_id,
        order_id: data.id,
        name: price.product_name,
        description: price.product_name,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.contact,
        },
      },
      product_name: price.product_name,
      thank_you_url: price.thank_you_url,
      prefill: customer,
    };
  }

  // -------------------------------------------------------------------------
  // Recurring: Subscriptions API
  // -------------------------------------------------------------------------
  private async createSubscription(
    params: PaymentProviderParams
  ): Promise<PaymentProviderResponse> {
    const { client, price, customer } = params;

    // A subscription cannot be created without a plan. This is a configuration
    // error rather than a gateway failure, so give an actionable message.
    if (!price.razorpay_plan_id) {
      throw new PaymentProviderError(
        'razorpay',
        400,
        { error: 'missing_plan' },
        `Price "${price.id}" is set to subscription but has no Razorpay plan. ` +
          `Open Admin > Prices and click "Create plan in Razorpay" for this product.`
      );
    }

    const contactDigits = customer.contact.replace(/\D/g, '');

    const formData = new URLSearchParams({
      plan_id: price.razorpay_plan_id,
      // total_count is required by Razorpay. Default to 12 cycles if unset.
      total_count: String(price.total_count ?? 12),
      quantity: '1',
      customer_notify: '1',
      'notes[name]': customer.name,
      'notes[email]': customer.email,
      'notes[contact]': contactDigits,
      'notes[product_name]': price.product_name,
      'notes[price_id]': price.id,
    });

    const response = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: razorpayAuthHeader(client),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      throw razorpayError(response.status, data, 'Razorpay subscription error');
    }

    return {
      gateway: 'razorpay',
      payment_type: 'subscription',
      order_id: data.id,
      subscription_id: data.id,
      checkout_data: {
        key: client.razorpay_key_id,
        // Checkout.js takes subscription_id INSTEAD of order_id for recurring.
        subscription_id: data.id,
        name: price.product_name,
        description: price.product_name,
        recurring: true,
        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.contact,
        },
      },
      product_name: price.product_name,
      thank_you_url: price.thank_you_url,
      prefill: customer,
    };
  }
}
