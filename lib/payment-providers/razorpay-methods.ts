/**
 * Razorpay Checkout payment method keys.
 *
 * These are the values accepted by Checkout.js as
 *   options.config.display.hide = [{ method: '<key>' }]
 *   options.method              = { '<key>': false }
 *
 * Hiding is SUBTRACTIVE and client-side only: it removes a method from the
 * modal, it cannot enable one that is disabled on the client's Razorpay
 * account, and it is not a security control.
 *
 * This module deliberately has no imports so it is safe to pull into both a
 * server route and a 'use client' component. Do NOT import these via
 * lib/payment-providers/index.ts from the browser -- that barrel pulls in the
 * provider implementations.
 */

export interface RazorpayMethodOption {
  key: string;
  label: string;
}

/** Methods offered on a one-time checkout. */
export const RAZORPAY_ONE_TIME_METHODS: RazorpayMethodOption[] = [
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Cards (credit/debit)' },
  { key: 'netbanking', label: 'Netbanking' },
  { key: 'wallet', label: 'Wallets' },
  { key: 'paylater', label: 'Pay Later' },
  { key: 'emi', label: 'EMI (card)' },
  { key: 'cardless_emi', label: 'Cardless EMI' },
];

/**
 * Methods offered on a recurring checkout.
 *
 * 'netbanking' is deliberately absent. In a recurring flow Razorpay surfaces
 * bank debit under its own key ('emandate'), so offering netbanking here would
 * be a tick that either does nothing or does something ambiguous -- and since
 * eMandate rides netbanking rails at the bank, a tick that appeared to work
 * could silently break the very flow it was meant to protect.
 */
export const RAZORPAY_SUBSCRIPTION_METHODS: RazorpayMethodOption[] = [
  { key: 'upi', label: 'UPI AutoPay' },
  { key: 'card', label: 'Cards (card mandate)' },
  { key: 'emandate', label: 'eMandate (bank debit)' },
  { key: 'nach', label: 'NACH' },
];

/**
 * Everything the admin API will accept. Superset of the two lists above, and
 * must stay in sync with the CHECK constraint in
 * migrations/004_hidden_payment_methods.sql.
 */
export const RAZORPAY_HIDEABLE_METHODS: string[] = [
  'card',
  'netbanking',
  'wallet',
  'upi',
  'emi',
  'cardless_emi',
  'paylater',
  'bank_transfer',
  'app',
  'emandate',
  'nach',
];

/** Method options to show for a given payment type. */
export function methodsForPaymentType(paymentType?: string | null): RazorpayMethodOption[] {
  return paymentType === 'subscription'
    ? RAZORPAY_SUBSCRIPTION_METHODS
    : RAZORPAY_ONE_TIME_METHODS;
}

/**
 * Compact summary for admin listings, e.g. "Cards, UPI".
 *
 * Uses short labels rather than the checkbox labels: the same key carries a
 * different parenthetical per payment type ("Cards (credit/debit)" vs "Cards
 * (card mandate)"), and a one-line table hint should not have to care which.
 */
const SHORT_LABELS: Record<string, string> = {
  card: 'Cards',
  upi: 'UPI',
  netbanking: 'Netbanking',
  wallet: 'Wallets',
  paylater: 'Pay Later',
  emi: 'EMI',
  cardless_emi: 'Cardless EMI',
  emandate: 'eMandate',
  nach: 'NACH',
  bank_transfer: 'Bank transfer',
  app: 'Apps',
};

export function describeHiddenMethods(keys?: string[] | null): string {
  if (!keys || !keys.length) return '';
  return keys.map((key) => SHORT_LABELS[key] ?? key).join(', ');
}
