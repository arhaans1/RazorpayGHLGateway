# Build Your Own Multi-Tenant Payment Gateway for GoHighLevel

A complete guide to building a multi-tenant payment gateway that integrates Razorpay and Cashfree with GoHighLevel (GHL) landing pages and funnels.

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Database Schema](#4-database-schema)
5. [Project Structure](#5-project-structure)
6. [Implementation Guide](#6-implementation-guide)
7. [Key Features Explained](#7-key-features-explained)
8. [Deployment](#8-deployment)
9. [GoHighLevel Integration](#9-gohighlevel-integration)
10. [Testing Your Setup](#10-testing-your-setup)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What This App Does

This is a **multi-tenant payment gateway** that allows you to:

- Accept payments on GoHighLevel landing pages using **Razorpay** or **Cashfree**
- Manage multiple clients, each with their own payment gateway credentials
- Create multiple products/prices per client
- Route different landing page URLs to different clients and products
- Provide a simple checkout snippet that works on any landing page

### Use Case Example

You run a marketing agency with multiple clients:
- **Client A** sells a course for ₹4,999 on `clienta.com/checkout`
- **Client B** sells consulting for ₹9,999 on `clientb.com/book`
- **Client C** sells a workshop for ₹1,999 on `clientc.com/register`

Each client has their own Razorpay/Cashfree account. This app routes each checkout URL to the correct client's payment gateway and product.

### How It Works

```
Customer visits: clienta.com/checkout?name=John&email=john@example.com&phone=9876543210
                              ↓
Checkout snippet extracts customer data from URL params
                              ↓
Calls your API: POST /api/create-order { page_url, name, email, contact }
                              ↓
API matches hostname + path → finds Client A + Course product
                              ↓
Creates order with Client A's Razorpay credentials
                              ↓
Returns checkout data → Opens Razorpay/Cashfree modal
                              ↓
On success → Redirects to thank_you_url
```

---

## 2. Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React framework |
| **Language** | TypeScript | Type-safe JavaScript |
| **Database** | Supabase (PostgreSQL) | Managed Postgres with auth |
| **Hosting** | Vercel | Serverless deployment |
| **Payment Gateways** | Razorpay, Cashfree | Indian payment processors |
| **Styling** | Tailwind CSS (optional) | Utility-first CSS |

### Why This Stack?

- **Next.js 14**: Server-side rendering, API routes, and React in one framework
- **Supabase**: Free tier with 500MB database, easy setup, great dashboard
- **Vercel**: Free tier, automatic deployments from GitHub, perfect for Next.js
- **Razorpay/Cashfree**: Popular Indian payment gateways with good APIs

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Landing Pages                           │
│         (GHL funnels, WordPress, custom sites, etc.)                │
│                                                                     │
│   Each page includes the checkout snippet:                          │
│   <script>...checkout code pointing to your Vercel app...</script>  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Your Payment Gateway App                         │
│                    (Next.js on Vercel)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Admin Panel    │  │   API Routes    │  │ Checkout Snippet│     │
│  │                 │  │                 │  │                 │     │
│  │ • Manage clients│  │ POST /api/      │  │ • Extracts      │     │
│  │ • Add prices    │  │   create-order  │  │   customer data │     │
│  │ • Configure     │  │                 │  │ • Calls API     │     │
│  │   routes        │  │ • Match URL to  │  │ • Opens payment │     │
│  │ • Copy snippet  │  │   funnel route  │  │   modal         │     │
│  │                 │  │ • Create order  │  │ • Handles       │     │
│  │                 │  │   with gateway  │  │   success/fail  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase Database                            │
├─────────────────────────────────────────────────────────────────────┤
│  clients          │  prices           │  funnel_routes              │
│  ─────────────    │  ─────────────    │  ─────────────              │
│  id (text)        │  id (text)        │  id (bigserial)             │
│  name             │  client_id (FK)   │  hostname                   │
│  razorpay_key_id  │  product_name     │  path_prefix                │
│  razorpay_secret  │  amount_paise     │  client_id (FK)             │
│  cashfree_app_id  │  currency         │  price_id (FK)              │
│  cashfree_secret  │  thank_you_url    │  gateway                    │
│  cashfree_env     │                   │  is_active                  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Payment Gateways                                │
│                                                                     │
│     ┌─────────────────┐           ┌─────────────────┐              │
│     │    Razorpay     │           │    Cashfree     │              │
│     │                 │           │                 │              │
│     │ • Create Order  │           │ • Create Order  │              │
│     │ • Checkout.js   │           │ • JS SDK        │              │
│     │ • Webhooks      │           │ • Webhooks      │              │
│     └─────────────────┘           └─────────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### Tables Overview

You need three main tables:

#### 4.1 Clients Table

Stores payment gateway credentials for each client.

```sql
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,                    -- Unique identifier (e.g., 'client-abc')
  name TEXT NOT NULL,                     -- Display name
  
  -- Razorpay credentials
  razorpay_key_id TEXT,                   -- Razorpay Key ID (rzp_live_xxx or rzp_test_xxx)
  razorpay_key_secret TEXT,               -- Razorpay Key Secret
  
  -- Cashfree credentials
  cashfree_app_id TEXT,                   -- Cashfree App ID
  cashfree_secret_key TEXT,               -- Cashfree Secret Key
  cashfree_env TEXT DEFAULT 'production', -- 'sandbox' or 'production'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.2 Prices Table

Stores products/prices for each client.

```sql
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,                    -- Unique identifier (e.g., 'price-xyz')
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,             -- Product name shown in checkout
  amount_paise INTEGER NOT NULL,          -- Amount in smallest unit (paise for INR)
  currency TEXT NOT NULL DEFAULT 'INR',   -- Currency code
  thank_you_url TEXT NOT NULL,            -- Redirect URL after successful payment
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4.3 Funnel Routes Table

Maps landing page URLs to clients and prices.

```sql
CREATE TABLE IF NOT EXISTS funnel_routes (
  id BIGSERIAL PRIMARY KEY,
  hostname TEXT NOT NULL,                 -- e.g., 'clienta.com' or 'lp.clienta.com'
  path_prefix TEXT NOT NULL,              -- e.g., '/checkout' or '/course/buy'
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  price_id TEXT NOT NULL REFERENCES prices(id) ON DELETE CASCADE,
  gateway TEXT DEFAULT 'razorpay',        -- 'razorpay' or 'cashfree'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hostname, path_prefix)           -- Each URL can only map to one route
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_funnel_routes_hostname_path ON funnel_routes(hostname, path_prefix);
CREATE INDEX IF NOT EXISTS idx_funnel_routes_active ON funnel_routes(is_active) WHERE is_active = TRUE;
```

### Relationships

```
clients (1) ────< (many) prices
   │
   └──────────────< (many) funnel_routes >──────────── prices
```

---

## 5. Project Structure

```
your-payment-gateway/
├── app/
│   ├── api/
│   │   └── create-order/
│   │       └── route.ts              # Main API: creates payment orders
│   │
│   ├── admin/
│   │   ├── layout.tsx                # Admin layout with navigation
│   │   ├── page.tsx                  # Admin dashboard
│   │   └── (protected)/
│   │       ├── clients/
│   │       │   └── page.tsx          # Manage clients + credentials
│   │       ├── prices/
│   │       │   └── page.tsx          # Manage products/prices
│   │       ├── funnel-routes/
│   │       │   └── page.tsx          # Map URLs to clients/prices
│   │       └── checkout-code/
│   │           └── page.tsx          # Copy checkout snippet
│   │
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing page (optional)
│
├── lib/
│   └── payment-providers/
│       ├── razorpay.ts               # Razorpay order creation logic
│       └── cashfree.ts               # Cashfree order creation logic
│
├── public/
│   └── checkout-snippet.html         # The checkout script to embed
│
├── .env.local                        # Environment variables (not committed)
├── schema.sql                        # Database schema
├── migrations/
│   └── add_cashfree.sql              # Add Cashfree support migration
├── package.json
└── tsconfig.json
```

---

## 6. Implementation Guide

### Step 1: Set Up Your Development Environment

```bash
# Prerequisites
- Node.js 18+ installed
- Git installed
- A code editor (VS Code recommended)
- Accounts on: Supabase, Vercel, GitHub
```

### Step 2: Create a New Next.js Project

```bash
# Create project
npx create-next-app@latest my-payment-gateway --typescript --tailwind --app --src-dir=false

# Navigate to project
cd my-payment-gateway

# Install dependencies
npm install @supabase/supabase-js razorpay
```

### Step 3: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the database to provision
3. Go to **SQL Editor** and run the schema:

```sql
-- Run the full schema from Section 4 above
-- Create clients table
-- Create prices table
-- Create funnel_routes table
-- Create indexes
```

4. Get your credentials from **Settings > API**:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - `anon` public key
   - `service_role` secret key

### Step 4: Configure Environment Variables

Create `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important:** 
- `NEXT_PUBLIC_*` variables are exposed to the browser (used in admin pages)
- Non-prefixed variables are server-only (used in API routes)

### Step 5: Create the API Route

Create `app/api/create-order/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

// Server-side Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { page_url, name, email, contact } = body;

    // Parse the URL to get hostname and path
    const url = new URL(page_url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    // Find matching funnel route
    const { data: routes, error: routeError } = await supabase
      .from('funnel_routes')
      .select(`
        *,
        clients (*),
        prices (*)
      `)
      .eq('hostname', hostname)
      .eq('is_active', true);

    if (routeError) throw routeError;

    // Find the route that matches the path prefix
    const matchingRoute = routes?.find(route => 
      pathname.startsWith(route.path_prefix)
    );

    if (!matchingRoute) {
      return NextResponse.json(
        { error: 'no_route_found', detail: `No route configured for ${hostname}${pathname}` },
        { status: 404, headers: corsHeaders }
      );
    }

    const client = matchingRoute.clients;
    const price = matchingRoute.prices;
    const gateway = matchingRoute.gateway || 'razorpay';

    // Create order based on gateway
    if (gateway === 'razorpay') {
      return await createRazorpayOrder(client, price, { name, email, contact }, corsHeaders);
    } else if (gateway === 'cashfree') {
      return await createCashfreeOrder(client, price, { name, email, contact }, corsHeaders);
    }

    return NextResponse.json(
      { error: 'invalid_gateway', detail: `Unknown gateway: ${gateway}` },
      { status: 400, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: 'server_error', detail: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function createRazorpayOrder(client: any, price: any, customer: any, headers: any) {
  const razorpay = new Razorpay({
    key_id: client.razorpay_key_id,
    key_secret: client.razorpay_key_secret,
  });

  const order = await razorpay.orders.create({
    amount: price.amount_paise,
    currency: price.currency,
    receipt: `receipt_${Date.now()}`,
  });

  return NextResponse.json({
    order_id: order.id,
    gateway: 'razorpay',
    product_name: price.product_name,
    thank_you_url: price.thank_you_url,
    checkout_data: {
      key: client.razorpay_key_id,
      order_id: order.id,
      name: price.product_name,
      description: price.product_name,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.contact,
      },
    },
  }, { headers });
}

async function createCashfreeOrder(client: any, price: any, customer: any, headers: any) {
  const env = client.cashfree_env || 'production';
  const baseUrl = env === 'sandbox' 
    ? 'https://sandbox.cashfree.com/pg/orders'
    : 'https://api.cashfree.com/pg/orders';

  const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const customerId = customer.email.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': client.cashfree_app_id,
      'x-client-secret': client.cashfree_secret_key,
      'x-api-version': '2023-08-01',
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: price.amount_paise / 100, // Cashfree expects rupees, not paise
      order_currency: price.currency,
      customer_details: {
        customer_id: customerId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.contact.replace(/\D/g, ''),
      },
      order_meta: {
        return_url: price.thank_you_url,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: 'cashfree_error', detail: data.message, gateway_response: data },
      { status: 400, headers }
    );
  }

  return NextResponse.json({
    order_id: orderId,
    gateway: 'cashfree',
    product_name: price.product_name,
    thank_you_url: price.thank_you_url,
    checkout_data: {
      payment_session_id: data.payment_session_id,
      env: env,
    },
  }, { headers });
}
```

### Step 6: Create the Checkout Snippet

Create `public/checkout-snippet.html`:

```html
<!--
  Universal Payment Gateway Checkout Snippet
  Paste this into your landing page checkout page
  
  IMPORTANT: Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
-->
<script>
  const API_BASE_URL = 'https://YOUR_VERCEL_URL.vercel.app';

  // Helper to load external scripts
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Handle Razorpay checkout
  async function handleRazorpayCheckout(data) {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    
    const options = {
      key: data.checkout_data.key,
      order_id: data.checkout_data.order_id,
      name: data.product_name,
      prefill: data.checkout_data.prefill,
      handler: function(response) {
        window.location.href = data.thank_you_url;
      },
      modal: {
        ondismiss: function() {
          alert('Payment cancelled.');
          window.history.back();
        }
      }
    };

    const razorpay = new Razorpay(options);
    razorpay.on('payment.failed', function(response) {
      alert('Payment failed: ' + response.error.description);
      window.history.back();
    });
    razorpay.open();
  }

  // Handle Cashfree checkout
  async function handleCashfreeCheckout(data) {
    const env = data.checkout_data.env || 'production';
    const sdkUrl = env === 'sandbox'
      ? 'https://sdk.cashfree.com/js/v3/cashfree.sandbox.js'
      : 'https://sdk.cashfree.com/js/v3/cashfree.js';
    
    await loadScript(sdkUrl);

    const cashfree = Cashfree({ mode: env === 'sandbox' ? 'sandbox' : 'production' });
    
    const result = await cashfree.checkout({
      paymentSessionId: data.checkout_data.payment_session_id,
      redirectTarget: '_modal'
    });

    if (result.paymentDetails) {
      const isSuccess = 
        (result.paymentDetails.paymentStatus || '').toUpperCase() === 'SUCCESS' ||
        (result.paymentDetails.paymentMessage || '').toLowerCase().includes('finished') ||
        (result.paymentDetails.paymentMessage || '').toLowerCase().includes('successful');
      
      if (isSuccess) {
        window.location.href = data.thank_you_url;
      } else {
        alert('Payment failed. Please try again.');
        window.history.back();
      }
    }
  }

  // Main initialization
  (async function() {
    // Extract customer data from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name') || urlParams.get('first_name') || '';
    const email = urlParams.get('email') || '';
    const phone = urlParams.get('phone') || urlParams.get('contact') || '';

    if (!name || !email || !phone) {
      alert('Missing customer information. Please ensure name, email, and phone are in the URL.');
      return;
    }

    try {
      // Call API to create order
      const response = await fetch(`${API_BASE_URL}/api/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_url: window.location.href,
          name,
          email,
          contact: phone,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || !data.order_id) {
        alert('Error: ' + (data.detail || 'Failed to create order'));
        return;
      }

      // Open appropriate payment gateway
      if (data.gateway === 'razorpay') {
        await handleRazorpayCheckout(data);
      } else if (data.gateway === 'cashfree') {
        await handleCashfreeCheckout(data);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  })();
</script>
```

### Step 7: Create Admin Pages

You need admin pages to manage:
1. **Clients** - Add/edit payment gateway credentials
2. **Prices** - Add/edit products and prices
3. **Funnel Routes** - Map URLs to clients/prices
4. **Checkout Code** - Copy the checkout snippet

Each admin page follows the same pattern:
- Fetch data from Supabase on load
- Display in a table
- Form to add/edit entries
- Delete functionality

Here's a simplified example for the Clients page:

```typescript
// app/admin/(protected)/clients/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    cashfree_app_id: '',
    cashfree_secret_key: '',
    cashfree_env: 'production',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase.from('clients').select('*');
    setClients(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const { error } = await supabase.from('clients').upsert([formData]);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      fetchClients();
      // Reset form...
    }
  }

  return (
    <div>
      <h1>Clients</h1>
      {/* Form and table UI */}
    </div>
  );
}
```

### Step 8: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Deploy

Your app will be available at `https://your-app.vercel.app`

---

## 7. Key Features Explained

### 7.1 URL-Based Routing

The system matches checkout pages by hostname + path:

| Hostname | Path Prefix | Client | Product |
|----------|-------------|--------|---------|
| `clienta.com` | `/checkout` | Client A | Course |
| `clienta.com` | `/vip` | Client A | VIP Package |
| `clientb.com` | `/buy` | Client B | Consulting |

When a customer visits `clienta.com/checkout?name=...`, the API:
1. Extracts hostname (`clienta.com`) and path (`/checkout`)
2. Finds the matching funnel route
3. Uses Client A's credentials to create the order
4. Returns Course product details

### 7.2 Multi-Gateway Support

Each funnel route specifies which gateway to use:
- **Razorpay**: Popular in India, supports cards, UPI, netbanking
- **Cashfree**: Alternative with similar features

The checkout snippet automatically loads the correct SDK based on the API response.

### 7.3 Customer Data Extraction

The checkout snippet extracts customer data from multiple sources (in order):
1. URL parameters: `?name=John&email=john@example.com&phone=9876543210`
2. Form fields on the page
3. JavaScript variables
4. localStorage/sessionStorage

This makes it compatible with GoHighLevel forms that pass data via URL params.

### 7.4 Error Handling

The system handles various error cases:
- No matching route found → Shows error message
- Payment gateway API failure → Shows detailed error
- Payment failed → Redirects back to landing page
- Payment cancelled → Redirects back to landing page

---

## 8. Deployment

### Environment Variables Required

```env
# Supabase (get from supabase.com > Project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vercel Deployment Steps

1. **Connect Repository**
   - Go to vercel.com
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Build Settings**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all four Supabase variables

4. **Deploy**
   - Click Deploy
   - Wait for build to complete
   - Your app is live!

### Post-Deployment

After deploying, update your checkout snippet with the real Vercel URL:

```javascript
const API_BASE_URL = 'https://your-actual-app.vercel.app';
```

---

## 9. GoHighLevel Integration

### Step 1: Create a GHL Funnel/Landing Page

1. In GoHighLevel, create a new funnel or landing page
2. Add your form to collect customer information
3. Configure the form to redirect to a checkout page with URL parameters

### Step 2: Set Up the Checkout Page

1. Create a new page in your funnel (this is the checkout page)
2. Add a "Custom Code" or "HTML" element
3. Paste your checkout snippet

### Step 3: Configure Form Redirect

Set your form's thank you page URL to include customer data:

```
https://yourdomain.com/checkout?name={{contact.first_name}}&email={{contact.email}}&phone={{contact.phone}}
```

GHL will replace the `{{...}}` placeholders with actual customer data.

### Step 4: Configure Your Gateway App

1. Go to your payment gateway admin panel
2. Add a new **Client** with your Razorpay/Cashfree credentials
3. Add a new **Price** for your product
4. Add a new **Funnel Route**:
   - Hostname: `yourdomain.com` (where GHL page is hosted)
   - Path Prefix: `/checkout`
   - Client: Select your client
   - Price: Select your product
   - Gateway: Razorpay or Cashfree

### Step 5: Test the Flow

1. Fill out the GHL form
2. You should be redirected to the checkout page
3. Payment modal should open automatically
4. Complete a test payment
5. Should redirect to thank you page

---

## 10. Testing Your Setup

### Test Credentials

**Razorpay Test Mode:**
- Use Key ID starting with `rzp_test_`
- Test card: `4111 1111 1111 1111`
- Any future expiry, any CVV

**Cashfree Sandbox:**
- Set `cashfree_env` to `sandbox`
- Use sandbox credentials from Cashfree dashboard
- Test card: `4111 1111 1111 1111`

### Checklist

- [ ] Database tables created in Supabase
- [ ] Environment variables set in Vercel
- [ ] At least one client added with credentials
- [ ] At least one price added
- [ ] At least one funnel route configured
- [ ] Checkout snippet updated with your Vercel URL
- [ ] Checkout snippet pasted in GHL page
- [ ] Form redirects with customer data in URL
- [ ] Test payment completes successfully
- [ ] Redirects to thank you page after payment

---

## 11. Troubleshooting

### "No route found for hostname"

**Problem:** The API can't find a matching funnel route.

**Solution:**
1. Check the hostname matches exactly (including/excluding `www`)
2. Check the path prefix matches (e.g., `/checkout` vs `/checkout/`)
3. Ensure the route is marked as active

### "Razorpay authentication failed"

**Problem:** Invalid Razorpay credentials.

**Solution:**
1. Verify Key ID and Secret are correct
2. Ensure you're using test credentials with test mode
3. Check for extra spaces in credentials

### "Cashfree customer_id is required"

**Problem:** Cashfree API validation error.

**Solution:**
The code generates customer_id from email. Ensure email is provided and valid.

### Payment succeeds but shows as failed

**Problem:** Cashfree returns different success messages.

**Solution:**
Update checkout snippet to check for multiple success indicators:
- `paymentStatus === 'SUCCESS'`
- `paymentMessage` contains 'finished' or 'successful'

### Database sequence error (duplicate key)

**Problem:** "duplicate key value violates unique constraint 'funnel_routes_pkey'"

**Solution:**
Run in Supabase SQL Editor:
```sql
SELECT setval(
  pg_get_serial_sequence('funnel_routes', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM funnel_routes)
);
```

---

## Quick Reference

### API Endpoint

```
POST https://your-app.vercel.app/api/create-order

Request Body:
{
  "page_url": "https://clienta.com/checkout?...",
  "name": "John Doe",
  "email": "john@example.com",
  "contact": "9876543210"
}

Response (Razorpay):
{
  "order_id": "order_xxx",
  "gateway": "razorpay",
  "product_name": "Course",
  "thank_you_url": "https://clienta.com/thank-you",
  "checkout_data": {
    "key": "rzp_xxx",
    "order_id": "order_xxx",
    "prefill": {...}
  }
}
```

### Admin URLs

- `/admin` - Dashboard
- `/admin/clients` - Manage clients
- `/admin/prices` - Manage prices
- `/admin/funnel-routes` - Manage URL routing
- `/admin/checkout-code` - Copy checkout snippet

---

## Next Steps

Once your basic setup is working, you can enhance the app with:

1. **Authentication** - Add admin login with Supabase Auth
2. **Webhooks** - Handle payment confirmation webhooks
3. **Transaction Logging** - Store payment records
4. **Analytics** - Track conversion rates
5. **Multiple Currencies** - Support USD, EUR, etc.
6. **Recurring Payments** - Add subscription support

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Razorpay Documentation](https://razorpay.com/docs/)
- [Cashfree Documentation](https://docs.cashfree.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [GoHighLevel Help](https://help.gohighlevel.com/)

---

*Built with Next.js, Supabase, and deployed on Vercel. Compatible with GoHighLevel, WordPress, and any landing page builder.*
