-- Migration: Fix funnel_routes primary key sequence desync
-- Run this in your Supabase SQL Editor.
--
-- SYMPTOM:
--   Adding a new funnel route fails with:
--   "duplicate key value violates unique constraint 'funnel_routes_pkey'"
--   even though the hostname/path is not a duplicate.
--
-- CAUSE:
--   funnel_routes.id is BIGSERIAL (auto-incremented from a sequence). At some
--   point rows were inserted with explicit id values (e.g. a Supabase Table
--   Editor CSV import or a manual SQL insert/restore). PostgreSQL does NOT
--   advance the sequence when an explicit id is supplied, so the sequence
--   counter fell behind MAX(id). nextval() then returns an id that already
--   exists, colliding with the primary key.
--
-- FIX:
--   Reset the sequence so the next generated id is greater than the current
--   MAX(id). pg_get_serial_sequence resolves the sequence name automatically.

SELECT setval(
  pg_get_serial_sequence('funnel_routes', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM funnel_routes)
);

-- Verify: the value below should be greater than MAX(id) in funnel_routes.
-- SELECT last_value FROM pg_get_serial_sequence('funnel_routes', 'id')::regclass;
