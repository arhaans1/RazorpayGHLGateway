/**
 * Razorpay Payment Provider
 * Handles order creation for Razorpay payment gateway
 */

import {
  PaymentProvider,
  PaymentProviderResponse,
  PaymentProviderParams,
  PaymentProviderError,
} from './types';

export class RazorpayProvider implements PaymentProvider {
  async createOrder(params: PaymentProviderParams): Promise<PaymentProviderResponse> {
    const { client, price, customer } = params;

    // Validate Razorpay credentials
    if (!client.razorpay_key_id || !client.razorpay_key_secret) {
      throw new PaymentProviderError(
        'razorpay',
        400,
        { error: 'missing_credentials' },
        'Razorpay credentials not configured for this client'
      );
    }

    // Prepare Razorpay order creation request
    const receiptId = `rcpt_${Date.now()}`;
    const contactDigits = customer.contact.replace(/\D/g, ''); // Remove non-digits

    // Form-encoded body for Razorpay API
    const formData = new URLSearchParams({
      amount: price.amount_paise.toString(),
      currency: price.currency.toUpperCase(),
      receipt: receiptId,
      payment_capture: '1',
      'notes[name]': customer.name,
      'notes[email]': customer.email,
      'notes[contact]': contactDigits,
      'notes[product_name]': price.product_name,
    });

    // Call Razorpay Orders API
    const razorpayAuth = Buffer.from(
      `${client.razorpay_key_id}:${client.razorpay_key_secret}`
    ).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${razorpayAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const razorpayData = await response.json();

    if (!response.ok || !razorpayData.id) {
      const errorDetail =
        razorpayData.error?.description ||
        razorpayData.error?.reason ||
        JSON.stringify(razorpayData);
      throw new PaymentProviderError(
        'razorpay',
        response.status || 500,
        razorpayData,
        `Razorpay API error: ${errorDetail}`
      );
    }

    // Return standardized response
    return {
      gateway: 'razorpay',
      order_id: razorpayData.id,
      checkout_data: {
        key: client.razorpay_key_id,
        order_id: razorpayData.id,
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
}

