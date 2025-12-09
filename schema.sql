-- Multi-tenant Razorpay Gateway Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Clients table: stores Razorpay account credentials per client
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  razorpay_key_id TEXT NOT NULL,
  razorpay_key_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prices table: stores product/price information per client
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  thank_you_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funnel routes table: maps hostname + path to client and price
CREATE TABLE IF NOT EXISTS funnel_routes (
  id BIGSERIAL PRIMARY KEY,
  hostname TEXT NOT NULL,
  path_prefix TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  price_id TEXT NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique hostname + path combinations
  UNIQUE(hostname, path_prefix)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_funnel_routes_hostname_path ON funnel_routes(hostname, path_prefix);
CREATE INDEX IF NOT EXISTS idx_funnel_routes_active ON funnel_routes(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_prices_client_id ON prices(client_id);
CREATE INDEX IF NOT EXISTS idx_funnel_routes_client_id ON funnel_routes(client_id);

