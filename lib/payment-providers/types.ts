/**
 * Payment Provider Types
 * Standardized interfaces for payment gateway providers
 */

export type PaymentGateway = 'razorpay' | 'cashfree';

export interface CustomerDetails {
  name: string;
  email: string;
  contact: string;
}

export interface Client {
  id: string;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
  cashfree_env?: 'sandbox' | 'production';
}

export interface Price {
  id: string;
  product_name: string;
  amount_paise: number;
  currency: string;
  thank_you_url: string;
}

export interface PaymentProviderResponse {
  gateway: PaymentGateway;
  order_id: string;
  checkout_data: {
    // Gateway-specific checkout payload
    // Razorpay: { key, order_id, name, description, prefill }
    // Cashfree: { payment_session_id, env }
    [key: string]: any;
  };
  product_name: string;
  thank_you_url: string;
  prefill: CustomerDetails;
}

export interface PaymentProviderParams {
  client: Client;
  price: Price;
  customer: CustomerDetails;
}

/**
 * Base interface for payment providers
 */
export interface PaymentProvider {
  createOrder(params: PaymentProviderParams): Promise<PaymentProviderResponse>;
}

export class PaymentProviderError extends Error {
  constructor(
    public gateway: PaymentGateway,
    public status: number,
    public details: any,
    message?: string
  ) {
    super(message || `Payment provider error: ${gateway}`);
    this.name = 'PaymentProviderError';
  }
}

