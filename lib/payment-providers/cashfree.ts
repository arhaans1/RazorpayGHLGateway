/**
 * Cashfree Payment Provider
 * Handles order creation for Cashfree payment gateway
 */

import {
  PaymentProvider,
  PaymentProviderResponse,
  PaymentProviderParams,
  PaymentProviderError,
} from './types';

export class CashfreeProvider implements PaymentProvider {
  async createOrder(params: PaymentProviderParams): Promise<PaymentProviderResponse> {
    const { client, price, customer } = params;

    // Validate Cashfree credentials
    if (!client.cashfree_app_id || !client.cashfree_secret_key) {
      throw new PaymentProviderError(
        'cashfree',
        400,
        { error: 'missing_credentials' },
        'Cashfree credentials not configured for this client'
      );
    }

    // Determine API base URL based on environment
    const baseUrl =
      client.cashfree_env === 'sandbox'
        ? 'https://sandbox.cashfree.com/pg'
        : 'https://api.cashfree.com/pg';

    // Cashfree uses amount in currency units (rupees), not paise
    // Convert from paise to rupees
    const orderAmount = price.amount_paise / 100;

    // Generate unique order ID
    const orderId = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate customer ID from email (required by Cashfree API)
    const customerId = customer.email.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

    // Prepare Cashfree order creation request
    const requestBody = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: price.currency.toUpperCase(),
      customer_details: {
        customer_id: customerId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.contact.replace(/\D/g, ''), // Remove non-digits
      },
      order_meta: {
        return_url: price.thank_you_url,
        notify_url: price.thank_you_url, // You can customize this later
      },
    };

    // Call Cashfree Orders API
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': client.cashfree_app_id,
        'x-client-secret': client.cashfree_secret_key,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const cashfreeData = await response.json();

    if (!response.ok || !cashfreeData.payment_session_id) {
      const errorDetail =
        cashfreeData.message ||
        cashfreeData.error ||
        JSON.stringify(cashfreeData);
      throw new PaymentProviderError(
        'cashfree',
        response.status || 500,
        cashfreeData,
        `Cashfree API error: ${errorDetail}`
      );
    }

    // Return standardized response
    return {
      gateway: 'cashfree',
      order_id: cashfreeData.order_id || orderId,
      checkout_data: {
        payment_session_id: cashfreeData.payment_session_id,
        env: client.cashfree_env || 'production',
      },
      product_name: price.product_name,
      thank_you_url: price.thank_you_url,
      prefill: customer,
    };
  }
}

