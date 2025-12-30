/**
 * Payment Provider Factory
 * Returns the appropriate payment provider based on gateway type
 */

import { PaymentGateway, PaymentProvider, Client } from './types';
import { RazorpayProvider } from './razorpay';
import { CashfreeProvider } from './cashfree';

export function getPaymentProvider(gateway: PaymentGateway): PaymentProvider {
  switch (gateway) {
    case 'razorpay':
      return new RazorpayProvider();
    case 'cashfree':
      return new CashfreeProvider();
    default:
      throw new Error(`Unsupported payment gateway: ${gateway}`);
  }
}

export * from './types';
export { RazorpayProvider } from './razorpay';
export { CashfreeProvider } from './cashfree';

