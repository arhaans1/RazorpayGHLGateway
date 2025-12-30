-- Migration: Add Cashfree payment gateway support
-- Run this in your Supabase SQL Editor after your initial schema.sql

-- Add Cashfree credentials to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS cashfree_app_id TEXT,
ADD COLUMN IF NOT EXISTS cashfree_secret_key TEXT,
ADD COLUMN IF NOT EXISTS cashfree_env TEXT DEFAULT 'production';

-- Add gateway selector to funnel_routes table
ALTER TABLE funnel_routes
ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'razorpay';

-- Ensure existing routes default to Razorpay
UPDATE funnel_routes 
SET gateway = 'razorpay' 
WHERE gateway IS NULL;

-- Add constraint to ensure valid gateway values (optional but recommended)
-- Note: PostgreSQL doesn't support CHECK constraints with TEXT in all versions
-- You can validate this at the application level instead

-- Create index for gateway lookups (optional optimization)
CREATE INDEX IF NOT EXISTS idx_funnel_routes_gateway ON funnel_routes(gateway) WHERE is_active = TRUE;

