-- Migration 002: Transaction persistence + webhook infrastructure (Stage 1)
-- Run this in your Supabase SQL Editor AFTER schema.sql and add_cashfree.sql
--
-- WHY THIS EXISTS
--   Until now the gateway was stateless: /api/create-order called Razorpay/Cashfree
--   and returned, persisting nothing. Payment success was asserted purely client-side
--   by the browser redirecting to thank_you_url. That means:
--     - no reconciliation, no payment history, no idempotency
--     - anyone navigating directly to thank_you_url looks identical to a payer
--   This migration adds the server-side record of truth.

-- ---------------------------------------------------------------------------
-- 1. Per-client webhook secrets
-- ---------------------------------------------------------------------------
-- Each client has their OWN Razorpay/Cashfree account, so each configures a
-- webhook in their own dashboard with their own secret. We therefore verify
-- webhook signatures per-tenant, not with one global secret.
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS razorpay_webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS cashfree_webhook_secret TEXT;

-- ---------------------------------------------------------------------------
-- 2. Transactions: one row per checkout attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,

  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  price_id  TEXT REFERENCES prices(id) ON DELETE SET NULL,

  gateway TEXT NOT NULL,                       -- 'razorpay' | 'cashfree'
  payment_type TEXT NOT NULL DEFAULT 'one_time', -- 'one_time' | 'subscription'

  -- Gateway identifiers. gateway_order_id is what we create up-front;
  -- gateway_payment_id arrives later via webhook.
  gateway_order_id        TEXT,
  gateway_payment_id      TEXT,
  gateway_subscription_id TEXT,

  -- Lifecycle: created -> paid | failed. refunded is terminal.
  status TEXT NOT NULL DEFAULT 'created',

  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',

  customer_name    TEXT,
  customer_email   TEXT,
  customer_contact TEXT,

  product_name TEXT,
  page_url     TEXT,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at    TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- gateway_order_id is the idempotency key: a webhook that fires twice for the
-- same order must not create a second row. Partial index so multiple NULLs are
-- allowed (a subscription transaction may have no order id at creation time).
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_gateway_order
  ON transactions(gateway, gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_client     ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_price      ON transactions(price_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status     ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created    ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON transactions(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_email      ON transactions(customer_email);

-- ---------------------------------------------------------------------------
-- 3. Webhook events: idempotency guard + audit trail
-- ---------------------------------------------------------------------------
-- Gateways retry webhooks on non-2xx. We record every delivery so a replay is
-- a no-op, and so failed processing is debuggable after the fact.
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
  gateway    TEXT NOT NULL,
  event_id   TEXT,          -- Razorpay: x-razorpay-event-id header
  event_type TEXT,          -- e.g. 'payment.captured', 'subscription.charged'
  payload    JSONB,
  processed  BOOLEAN DEFAULT FALSE,
  error      TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedupe
  ON webhook_events(gateway, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_client   ON webhook_events(client_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Lock these tables down
-- ---------------------------------------------------------------------------
-- The admin UI now reads through server-side /api/admin/* routes using the
-- service-role key (which bypasses RLS), so no anon access is needed here.
-- Enabling RLS with no permissive policy means the public anon key can read
-- nothing from these tables.
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
