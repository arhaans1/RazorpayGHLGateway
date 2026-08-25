/**
 * Payment Provider Types
 * Standardized interfaces for payment gateway providers
 */

export type PaymentGateway = 'razorpay' | 'cashfree';

/**
 * one_time     — a single charge (Razorpay Orders API / Cashfree Orders API)
 * subscription — recurring charges (Razorpay Plans + Subscriptions API)
 */
export type PaymentType = 'one_time' | 'subscription';

export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

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

  // Recurring configuration. Only meaningful when payment_type === 'subscription'.
  payment_type?: PaymentType;
  razorpay_plan_id?: string | null;
  billing_period?: BillingPeriod | null;
  billing_interval?: number | null;
  total_count?: number | null;

  /**
   * Razorpay Checkout method keys to hide, e.g. ['upi', 'card'].
   * Applies to BOTH payment types, so it sits outside the recurring block above.
   * See lib/payment-providers/razorpay-methods.ts for the valid keys.
   */
  hidden_payment_methods?: string[] | null;
}

export interface PaymentProviderResponse {
  gateway: PaymentGateway;
  payment_type: PaymentType;

  /**
   * Primary gateway reference for this checkout.
   * one_time     -> the gateway order id
   * subscription -> the gateway subscription id
   *
   * Kept as `order_id` so previously-deployed checkout snippets keep working.
   */
  order_id: string;

  /** Set only for subscriptions. */
  subscription_id?: string;

  checkout_data: {
    // Gateway-specific checkout payload handed straight to the browser SDK.
    // Razorpay one-time:     { key, order_id, name, description, prefill }
    // Razorpay subscription: { key, subscription_id, name, description, prefill }
    // Cashfree:              { payment_session_id, env }
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
 * Base interface for payment providers.
 *
 * `createOrder` dispatches on price.payment_type, so a provider that supports
 * recurring returns a subscription payload from the same entry point.
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
