-- Migration 003: Razorpay subscription support (Stage 2)
-- Run this in your Supabase SQL Editor AFTER 002_transactions_and_webhooks.sql
--
-- HOW RAZORPAY SUBSCRIPTIONS DIFFER FROM ORDERS
--   One-time: POST /v1/orders          -> order_id        -> checkout {order_id}
--   Recurring: POST /v1/plans (once)   -> plan_id
--              POST /v1/subscriptions  -> subscription_id -> checkout {subscription_id}
--
--   A plan is a reusable template (amount + billing cycle) and lives inside the
--   CLIENT's own Razorpay account, so plan ids are stored per price.
--
--   Renewals are charged by Razorpay months later with no browser present, so
--   subscription state can ONLY be tracked via webhooks (migration 002).

-- ---------------------------------------------------------------------------
-- 1. Prices become either one-time or recurring
-- ---------------------------------------------------------------------------
ALTER TABLE prices
ADD COLUMN IF NOT EXISTS payment_type      TEXT NOT NULL DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS razorpay_plan_id  TEXT,
ADD COLUMN IF NOT EXISTS billing_period    TEXT,               -- daily|weekly|monthly|yearly
ADD COLUMN IF NOT EXISTS billing_interval  INTEGER DEFAULT 1,  -- every N periods
ADD COLUMN IF NOT EXISTS total_count       INTEGER;            -- number of billing cycles

-- Existing rows are all one-time; make that explicit.
UPDATE prices SET payment_type = 'one_time' WHERE payment_type IS NULL;

COMMENT ON COLUMN prices.payment_type IS 'one_time | subscription';
COMMENT ON COLUMN prices.razorpay_plan_id IS 'Plan id created in the client''s own Razorpay account';
COMMENT ON COLUMN prices.total_count IS 'Billing cycles to charge, e.g. 12 monthly = 1 year';

-- ---------------------------------------------------------------------------
-- 2. Subscriptions: one row per customer subscription
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,

  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  price_id  TEXT REFERENCES prices(id) ON DELETE SET NULL,

  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_subscription_id TEXT NOT NULL,
  gateway_plan_id         TEXT,

  -- Mirrors Razorpay's subscription states:
  -- created, authenticated, active, pending, halted, cancelled, completed, expired
  status TEXT NOT NULL DEFAULT 'created',

  customer_name    TEXT,
  customer_email   TEXT,
  customer_contact TEXT,

  product_name TEXT,
  charge_amount_paise INTEGER,
  currency TEXT DEFAULT 'INR',

  total_count INTEGER,           -- cycles agreed
  paid_count  INTEGER DEFAULT 0, -- cycles actually charged so far

  current_start TIMESTAMPTZ,
  current_end   TIMESTAMPTZ,
  charge_at     TIMESTAMPTZ,     -- next scheduled charge
  ended_at      TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_gateway_id
  ON subscriptions(gateway, gateway_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_price  ON subscriptions(price_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email  ON subscriptions(customer_email);

-- Link a renewal transaction back to its subscription.
CREATE INDEX IF NOT EXISTS idx_transactions_subscription
  ON transactions(gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
