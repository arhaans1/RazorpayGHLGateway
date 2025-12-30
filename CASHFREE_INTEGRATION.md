# Cashfree Payment Gateway Integration

This document describes the Cashfree payment gateway integration that has been added to the system alongside Razorpay.

## Overview

The system now supports **multiple payment gateways** using a clean provider pattern. Both Razorpay and Cashfree are fully supported, and the architecture allows for easy addition of more gateways in the future.

## What Changed

### 1. Database Schema

**Migration File:** `migrations/add_cashfree.sql`

#### Clients Table
Added columns:
- `cashfree_app_id` (TEXT) - Cashfree App ID
- `cashfree_secret_key` (TEXT) - Cashfree Secret Key
- `cashfree_env` (TEXT) - Environment: 'sandbox' or 'production' (default: 'production')

#### Funnel Routes Table
Added column:
- `gateway` (TEXT) - Payment gateway selection: 'razorpay' or 'cashfree' (default: 'razorpay')

**Note:** All existing routes default to 'razorpay' for backward compatibility.

### 2. Backend Architecture

**New Provider Pattern:**
- `lib/payment-providers/types.ts` - TypeScript interfaces and types
- `lib/payment-providers/razorpay.ts` - Razorpay provider implementation
- `lib/payment-providers/cashfree.ts` - Cashfree provider implementation
- `lib/payment-providers/index.ts` - Provider factory

**API Changes:**
- `/api/create-order` now uses the provider pattern
- Automatically selects the correct provider based on route's `gateway` field
- Returns standardized response format regardless of gateway

### 3. Frontend/Checkout Snippet

**File:** `public/checkout-snippet.html`

The checkout snippet now:
- Dynamically loads the appropriate payment gateway SDK (Razorpay or Cashfree)
- Handles both gateway types based on API response
- Supports both gateways without any client-side configuration

### 4. Admin Panel Updates

#### Clients Page
- Added Cashfree credential fields (optional)
- Cashfree App ID input
- Cashfree Secret Key input (password field)
- Cashfree Environment dropdown (Production/Sandbox)

#### Funnel Routes Page
- Added Gateway selector dropdown (Razorpay/Cashfree)
- Gateway column in routes table with color-coded badges
- Validation note about ensuring client has gateway credentials

## How to Use

### Step 1: Run Database Migration

Execute the SQL migration file in your Supabase SQL Editor:
```sql
-- See migrations/add_cashfree.sql
```

### Step 2: Configure Cashfree Credentials

1. Go to Admin Panel → Clients
2. Edit or create a client
3. Fill in Cashfree credentials (optional - only if using Cashfree):
   - Cashfree App ID
   - Cashfree Secret Key
   - Environment (Production/Sandbox)

### Step 3: Create/Update Funnel Route

1. Go to Admin Panel → Funnel Routes
2. Create a new route or edit an existing one
3. Select the payment gateway (Razorpay or Cashfree)
4. Ensure the selected client has credentials for the chosen gateway

### Step 4: Use the Checkout Snippet

The checkout snippet remains the same - it automatically detects and uses the correct gateway based on your route configuration. No changes needed on your checkout pages!

## Testing

### Test Razorpay Route
1. Create a route with gateway = 'razorpay'
2. Ensure client has Razorpay credentials
3. Test payment flow

### Test Cashfree Route
1. Create a route with gateway = 'cashfree'
2. Ensure client has Cashfree credentials
3. Test payment flow in Sandbox mode first

### Test Both Gateways for Same Client
1. Configure client with both Razorpay and Cashfree credentials
2. Create two routes with same client but different gateways
3. Test both routes independently

## Important Notes

1. **Backward Compatibility:** All existing routes default to Razorpay. No breaking changes.

2. **Gateway Selection:** Each route can use a different gateway. Same client can use different gateways for different routes.

3. **Credentials:** 
   - Razorpay credentials are **required** for all clients
   - Cashfree credentials are **optional** - only needed if you plan to use Cashfree

4. **Amount Format:**
   - Both gateways use the same `amount_paise` field in the prices table
   - Razorpay uses paise directly
   - Cashfree converts paise to rupees (amount_paise / 100)

5. **Error Handling:** 
   - The system validates that gateway credentials exist before attempting payment
   - Clear error messages guide you if credentials are missing

## Architecture Benefits

1. **Clean Separation:** Each gateway provider is isolated in its own module
2. **Easy Extension:** Adding new gateways (Stripe, PayU, etc.) is straightforward
3. **Type Safety:** TypeScript interfaces ensure consistent provider implementations
4. **Standardized Response:** Same response format regardless of gateway

## Future Enhancements

Potential additions:
- Webhook handling (per gateway)
- Payment method filtering
- Gateway-specific features
- Analytics per gateway

## Troubleshooting

### Payment popup doesn't open
- Check browser console for errors
- Verify gateway credentials are correct
- Ensure route has correct gateway selected

### "Missing credentials" error
- Verify client has credentials for the selected gateway
- Check Cashfree environment setting (sandbox vs production)

### Cashfree sandbox testing
- Use Cashfree sandbox credentials
- Set `cashfree_env` to 'sandbox' in client configuration
- Test with sandbox payment methods

