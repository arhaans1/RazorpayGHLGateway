# Multi-Tenant Razorpay Gateway

A Next.js microservice for managing multi-tenant Razorpay order creation. Each client can have their own Razorpay account, products, and checkout pages mapped via domain + path.

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to SQL Editor
3. Run the SQL from `schema.sql` to create the tables

### 2. Environment Variables

Create a `.env.local` file (for local development) and set these in Vercel:

**Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Supabase dashboard > Settings > API)
- `ADMIN_PASSWORD` - Password for admin login (default: `admin123`)

**For Admin UI (client-side):**
- `NEXT_PUBLIC_SUPABASE_URL` - Same as SUPABASE_URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

**Optional:**
- `NEXT_PUBLIC_BASE_URL` - Your deployed URL (for logout redirect)

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000/admin/login` to access the admin panel.

### 5. Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Usage

### Admin UI

1. Login at `/admin/login` with your `ADMIN_PASSWORD`
2. **Clients**: Add clients with their Razorpay credentials
3. **Prices**: Create products/prices for each client
4. **Funnel Routes**: Map hostname + path to client + price

### Frontend Checkout Snippet

1. Copy the code from `public/checkout-snippet.html`
2. Replace `YOUR_VERCEL_URL` with your actual Vercel deployment URL
3. Paste into your GoHighLevel or Landing Page checkout page

The snippet will:
- Read name, email, phone from URL parameters
- Automatically detect the page URL
- Call your backend to create a Razorpay order
- Open Razorpay checkout
- Redirect to thank you page on success

### Example URL Parameters

```
https://yourdomain.com/checkout?name=John%20Doe&email=john@example.com&phone=9876543210
```

## API Endpoint

### POST `/api/create-order`

**Request:**
```json
{
  "page_url": "https://launchwithai.in/checkout",
  "name": "User Name",
  "email": "user@example.com",
  "contact": "9876543210"
}
```

**Response (Success):**
```json
{
  "order_id": "order_xxx",
  "key_id": "rzp_test_xxx",
  "product_name": "DevOps in 3 Days",
  "thank_you_url": "https://launchwithai.in/thank-you",
  "prefill": {
    "name": "User Name",
    "email": "user@example.com",
    "contact": "9876543210"
  }
}
```

**Response (Error):**
```json
{
  "error": "route_not_found",
  "detail": "No active route found for launchwithai.in/checkout"
}
```

## Database Schema

### clients
- `id` (text, PK) - Unique client identifier
- `name` (text) - Client name
- `razorpay_key_id` (text) - Razorpay API key ID
- `razorpay_key_secret` (text) - Razorpay API key secret
- `created_at` (timestamptz)

### prices
- `id` (text, PK) - Unique price identifier
- `client_id` (text, FK) - References clients.id
- `product_name` (text) - Product name
- `amount_paise` (integer) - Amount in paise (e.g., 199900 = ₹1,999)
- `currency` (text) - Currency code (INR, USD, etc.)
- `thank_you_url` (text) - Redirect URL after payment
- `created_at` (timestamptz)

### funnel_routes
- `id` (bigserial, PK)
- `hostname` (text) - Domain name (e.g., launchwithai.in)
- `path_prefix` (text) - Path (e.g., /checkout)
- `client_id` (text, FK) - References clients.id
- `price_id` (text, FK) - References prices.id
- `is_active` (boolean) - Whether route is active
- `created_at` (timestamptz)

## Security Notes

- The admin UI uses simple password-based auth (stored in env var)
- For production, consider implementing proper authentication
- Supabase RLS (Row Level Security) can be added later for multi-user access
- The service role key is only used server-side (never exposed to client)
- Client-side admin UI uses the anon key (you may want to add RLS policies)

## Troubleshooting

1. **CORS errors**: The API route includes CORS headers. If issues persist, check your Vercel deployment URL.

2. **Route not found**: Ensure:
   - Hostname matches exactly (no www, no protocol)
   - Path prefix matches exactly (case-sensitive)
   - Route is marked as active

3. **Razorpay order creation fails**: Check:
   - Client's Razorpay credentials are correct
   - Amount is in paise (not rupees)
   - Razorpay account is active

4. **Admin UI not loading data**: Check:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
   - Supabase tables exist and have data
   - Browser console for errors

