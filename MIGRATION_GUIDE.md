# Database Migration Guide

## Step 1: Run the Migration SQL

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `migrations/add_cashfree.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

The migration will:
- ✅ Add Cashfree columns to `clients` table
- ✅ Add `gateway` column to `funnel_routes` table
- ✅ Set all existing routes to use 'razorpay' by default
- ✅ Create an index for better performance

## Step 2: Verify Migration

After running the migration, verify it worked:

```sql
-- Check clients table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
AND column_name LIKE 'cashfree%';

-- Check funnel_routes has gateway column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'funnel_routes' 
AND column_name = 'gateway';

-- Check existing routes default to razorpay
SELECT gateway, COUNT(*) 
FROM funnel_routes 
GROUP BY gateway;
```

Expected results:
- `clients` table should have: `cashfree_app_id`, `cashfree_secret_key`, `cashfree_env`
- `funnel_routes` table should have: `gateway` column
- All existing routes should have `gateway = 'razorpay'`

## Troubleshooting

If you get an error:
- **"column already exists"** - Migration already ran, you're good!
- **"relation does not exist"** - Make sure you've run the initial `schema.sql` first
- **Permission denied** - Make sure you're using the SQL Editor (not a restricted user)

## After Migration

Once migration is complete:
1. ✅ Your existing Razorpay routes will continue working
2. ✅ You can now add Cashfree credentials to clients
3. ✅ You can create new routes with Cashfree gateway
4. ✅ The checkout snippet will automatically use the correct gateway

