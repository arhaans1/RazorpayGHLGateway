-- Migration 004: Per-product payment method hiding
-- Run this in your Supabase SQL Editor AFTER 003_subscriptions.sql
--
-- WHY THIS LIVES ON prices
--   Razorpay Checkout.js accepts inline method restrictions in its options:
--     options.config = { display: { hide: [{ method: 'upi' }] } }
--     options.method = { upi: false }
--
--   We use those rather than checkout_config_id (a dashboard-created
--   configuration passed on the Orders API) because POST /v1/subscriptions does
--   NOT accept checkout_config_id -- its only parameters are plan_id,
--   total_count, quantity, customer_notify, start_at, expire_by, addons, notes
--   and offer_id. One mechanism has to cover both one-time and recurring
--   products, and only the checkout-options route does.
--
--   NOTE: this is a client-side DISPLAY FILTER, not an enforcement boundary. It
--   removes a method from the modal; it cannot disable one on the account, and
--   anyone with devtools can strip it. If real enforcement is ever needed, that
--   is account-level settings in the Razorpay dashboard, not this column.

ALTER TABLE prices
ADD COLUMN IF NOT EXISTS hidden_payment_methods TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN prices.hidden_payment_methods IS
  'Razorpay Checkout method keys to hide, e.g. {upi,card}. Empty = show all. Display filter only.';

-- Defence in depth: the admin API validates this too, but a bug there must not
-- be able to push junk into a live checkout config.
-- (Postgres has no ADD CONSTRAINT IF NOT EXISTS, so drop then add.)
ALTER TABLE prices DROP CONSTRAINT IF EXISTS prices_hidden_payment_methods_valid;
ALTER TABLE prices ADD CONSTRAINT prices_hidden_payment_methods_valid
  CHECK (hidden_payment_methods <@ ARRAY[
    'card','netbanking','wallet','upi','emi','cardless_emi',
    'paylater','bank_transfer','app','emandate','nach'
  ]::text[]);

-- PostgREST caches the schema. Supabase usually reloads on its own, but a stale
-- cache surfaces as "column does not exist" on EVERY checkout, so force it.
NOTIFY pgrst, 'reload schema';
