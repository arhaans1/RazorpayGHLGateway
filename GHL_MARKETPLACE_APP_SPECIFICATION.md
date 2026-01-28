# GHL Marketplace Payment App - Implementation Specification

## Document Version: 1.0
## Date: January 2026

---

# Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Goals & Scope](#2-project-goals--scope)
3. [GHL Custom Payment Provider Overview](#3-ghl-custom-payment-provider-overview)
4. [Technical Architecture](#4-technical-architecture)
5. [GHL Developer Portal Setup](#5-ghl-developer-portal-setup)
6. [Database Schema](#6-database-schema)
7. [OAuth Implementation](#7-oauth-implementation)
8. [Settings Page (Custom Page)](#8-settings-page-custom-page)
9. [Payments URL (Checkout Page)](#9-payments-url-checkout-page)
10. [Query URL (Backend API)](#10-query-url-backend-api)
11. [Payment Flow Diagrams](#11-payment-flow-diagrams)
12. [API Reference](#12-api-reference)
13. [Environment Variables](#13-environment-variables)
14. [Step-by-Step Implementation Guide](#14-step-by-step-implementation-guide)
15. [Testing Checklist](#15-testing-checklist)
16. [Deployment Guide](#16-deployment-guide)
17. [Troubleshooting](#17-troubleshooting)

---

# 1. Executive Summary

## What We're Building

A **free GoHighLevel Marketplace App** that allows GHL users to integrate **Razorpay** and **Cashfree** payment gateways with their GHL sub-accounts. Users can then accept payments through GHL's native payment features (Order Forms, Invoices, Payment Links, E-commerce).

## Key Characteristics

| Attribute | Value |
|-----------|-------|
| App Type | Custom Payment Provider |
| Pricing | FREE (no charges, no revenue share) |
| Payment Types | One-time payments only (no subscriptions) |
| Supported Gateways | Razorpay, Cashfree |
| Target Market | India (INR payments) |
| Tech Stack | Next.js 14, TypeScript, Supabase, Vercel |

## What This App Does NOT Do

- ❌ Recurring/subscription payments (future scope)
- ❌ Off-session charging
- ❌ Saved payment methods
- ❌ SaaS mode billing
- ❌ Charge users for the app

---

# 2. Project Goals & Scope

## In Scope (MVP)

1. **GHL Marketplace App** listed in Third Party Providers category
2. **OAuth flow** for app installation on GHL sub-accounts
3. **Settings page** where users enter Razorpay/Cashfree API credentials
4. **Checkout page** (paymentsUrl) loaded in GHL iframe for processing payments
5. **Backend API** (queryUrl) for payment verification and refunds
6. **Support for both Razorpay and Cashfree** (user chooses which to configure)

## Out of Scope (Future)

- Subscription/recurring payments
- Saved payment methods (tokenization)
- Multi-currency support (beyond INR)
- Analytics dashboard
- Webhook notifications to external systems

---

# 3. GHL Custom Payment Provider Overview

## How GHL Custom Payment Providers Work

GoHighLevel's Custom Payment Provider framework allows third-party apps to handle payments for:
- Order Forms (Funnels)
- E-commerce Stores
- Payment Links
- Invoices
- Forms
- Text2Pay

## Key Components

### 3.1 Marketplace App
The container for your integration. Defines:
- OAuth configuration
- Required scopes
- App category (Third Party Provider)
- Custom pages

### 3.2 Custom Payment Provider Config
Tells GHL your app is a payment provider:
- Provider name and logo
- Supported payment types
- queryUrl endpoint
- paymentsUrl endpoint
- Required configuration fields

### 3.3 queryUrl
Your **backend endpoint** that GHL calls for:
- `verify` - Confirm payment success
- `refund` - Process refund requests

### 3.4 paymentsUrl
Your **frontend page** that:
- Loads inside GHL's iframe
- Receives payment details from GHL
- Shows Razorpay/Cashfree checkout
- Reports result back to GHL

---

# 4. Technical Architecture

## 4.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      GoHighLevel Platform                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Order Forms  │ │   Invoices   │ │Payment Links │             │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘             │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │ GHL Payment Gateway   │                          │
│              │ Integration Layer     │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌───────────────────────┐
│   paymentsUrl         │    │   queryUrl            │
│   (Frontend)          │    │   (Backend API)       │
│                       │    │                       │
│ • Checkout iframe     │    │ • POST /api/query     │
│ • Razorpay/Cashfree   │    │ • verify operation    │
│   SDK integration     │    │ • refund operation    │
│ • postMessage to GHL  │    │                       │
└───────────┬───────────┘    └───────────┬───────────┘
            │                             │
            └──────────────┬──────────────┘
                           │
                           ▼
            ┌───────────────────────────────┐
            │   Your GHL Marketplace App    │
            │   (Next.js on Vercel)         │
            ├───────────────────────────────┤
            │ • OAuth handler               │
            │ • Settings page               │
            │ • Checkout page               │
            │ • Query API                   │
            └───────────────┬───────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
┌───────────────────────┐    ┌───────────────────────┐
│   Supabase            │    │   Payment Gateways    │
│   (PostgreSQL)        │    │                       │
│                       │    │ • Razorpay API        │
│ • installations       │    │ • Cashfree API        │
│ • credentials         │    │                       │
│ • transactions        │    │                       │
└───────────────────────┘    └───────────────────────┘
```

## 4.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Hosting | Vercel |
| Payment SDKs | Razorpay Checkout.js, Cashfree JS SDK |
| Styling | Tailwind CSS |

## 4.3 Project Structure

```
ghl-payment-marketplace-app/
├── app/
│   ├── api/
│   │   ├── oauth/
│   │   │   ├── callback/route.ts    # OAuth callback handler
│   │   │   └── route.ts             # OAuth initiation
│   │   ├── query/route.ts           # queryUrl endpoint
│   │   └── webhooks/
│   │       ├── razorpay/route.ts    # Razorpay webhooks
│   │       └── cashfree/route.ts    # Cashfree webhooks
│   ├── checkout/
│   │   └── page.tsx                 # paymentsUrl - checkout iframe
│   ├── settings/
│   │   └── page.tsx                 # Custom page - API key settings
│   ├── layout.tsx
│   └── page.tsx                     # Landing/home page
├── components/
│   ├── checkout/
│   │   ├── RazorpayCheckout.tsx
│   │   └── CashfreeCheckout.tsx
│   └── settings/
│       └── CredentialsForm.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── ghl/
│   │   ├── oauth.ts                 # GHL OAuth helpers
│   │   └── api.ts                   # GHL API calls
│   ├── payment-providers/
│   │   ├── razorpay.ts
│   │   └── cashfree.ts
│   └── utils.ts
├── types/
│   ├── ghl.ts                       # GHL-specific types
│   └── payments.ts
├── .env.local
├── package.json
└── README.md
```

---

# 5. GHL Developer Portal Setup

## 5.1 Prerequisites

1. GoHighLevel account (Agency or Sub-account)
2. Access to GHL Developer Portal: https://marketplace.gohighlevel.com

## 5.2 Create Marketplace App

### Step 1: Access Developer Portal
1. Go to https://marketplace.gohighlevel.com
2. Log in with your GHL credentials
3. Navigate to "My Apps"

### Step 2: Create New App
1. Click "Create App"
2. Fill in basic details:
   - **App Name**: "Razorpay & Cashfree Payments" (or your preferred name)
   - **App Description**: "Accept payments via Razorpay and Cashfree payment gateways"
   - **Category**: Select "Third Party Provider"
   - **App Logo**: Upload a logo (recommended: 512x512px PNG)

### Step 3: Configure OAuth
1. In app settings, go to "Auth" section
2. Set **Redirect URL**: `https://your-domain.vercel.app/api/oauth/callback`
3. Note down:
   - **Client ID**
   - **Client Secret**

### Step 4: Configure Scopes
Select these required scopes:
```
payments/orders.readonly
payments/orders.write
payments/transactions.readonly
payments/custom-provider.readonly
payments/custom-provider.write
```

### Step 5: Configure Custom Page
1. Go to "Custom Pages" section
2. Add a custom page:
   - **Page Name**: "Settings"
   - **Page URL**: `https://your-domain.vercel.app/settings`
   - This page loads after installation for users to enter API keys

### Step 6: Configure Payment Provider
1. Go to "Payment Provider" section
2. Fill in:
   - **Provider Name**: "Razorpay & Cashfree"
   - **Provider Description**: "Accept payments via Razorpay or Cashfree"
   - **Logo URL**: Your provider logo URL
   - **queryUrl**: `https://your-domain.vercel.app/api/query`
   - **paymentsUrl**: `https://your-domain.vercel.app/checkout`
   - **Supported Payment Types**: Select "OneTime" only
   - **Live Mode Config Fields**:
     - `apiKey` (label: "API Key")
     - `publishableKey` (label: "Publishable Key")
   - **Test Mode Config Fields**: Same as above

### Step 7: Distribution Settings
1. Go to "Distribution" section
2. Select "Public" (available to all GHL users)
3. Set pricing as "Free"

### Step 8: Submit for Review
1. Complete all required fields
2. Add screenshots
3. Submit for GHL review

---

# 6. Database Schema

## 6.1 Supabase Tables

### Table: `ghl_installations`

Stores OAuth tokens and installation data for each GHL location (sub-account).

```sql
CREATE TABLE ghl_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) UNIQUE NOT NULL,
  company_id VARCHAR(255),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Index for fast lookups
CREATE INDEX idx_installations_location_id ON ghl_installations(location_id);
```

### Table: `payment_credentials`

Stores encrypted payment gateway credentials per installation.

```sql
CREATE TABLE payment_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) NOT NULL REFERENCES ghl_installations(location_id),
  gateway VARCHAR(50) NOT NULL, -- 'razorpay' or 'cashfree'
  is_test_mode BOOLEAN DEFAULT true,

  -- Razorpay credentials
  razorpay_key_id TEXT,
  razorpay_key_secret TEXT, -- encrypted

  -- Cashfree credentials
  cashfree_app_id TEXT,
  cashfree_secret_key TEXT, -- encrypted

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(location_id, gateway)
);

CREATE INDEX idx_credentials_location ON payment_credentials(location_id);
```

### Table: `transactions`

Logs all payment transactions for reference and debugging.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) NOT NULL,
  ghl_transaction_id VARCHAR(255),
  ghl_order_id VARCHAR(255),

  gateway VARCHAR(50) NOT NULL, -- 'razorpay' or 'cashfree'
  gateway_order_id VARCHAR(255),
  gateway_payment_id VARCHAR(255),

  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  status VARCHAR(50) NOT NULL, -- 'pending', 'success', 'failed', 'refunded'

  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),

  metadata JSONB,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_location ON transactions(location_id);
CREATE INDEX idx_transactions_ghl_id ON transactions(ghl_transaction_id);
CREATE INDEX idx_transactions_gateway_id ON transactions(gateway_payment_id);
```

## 6.2 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE ghl_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth strategy)
-- For server-side access, you'll use service_role key which bypasses RLS
```

---

# 7. OAuth Implementation

## 7.1 OAuth Flow Overview

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│   GHL   │         │Your App │         │   GHL   │
│  User   │         │         │         │  OAuth  │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │  1. Install App   │                   │
     │──────────────────>│                   │
     │                   │                   │
     │                   │ 2. Redirect to    │
     │                   │    GHL OAuth      │
     │                   │──────────────────>│
     │                   │                   │
     │  3. User Authorizes                   │
     │<──────────────────────────────────────│
     │                   │                   │
     │                   │ 4. Callback with  │
     │                   │    auth code      │
     │                   │<──────────────────│
     │                   │                   │
     │                   │ 5. Exchange code  │
     │                   │    for tokens     │
     │                   │──────────────────>│
     │                   │                   │
     │                   │ 6. Receive tokens │
     │                   │<──────────────────│
     │                   │                   │
     │ 7. Redirect to    │                   │
     │    Settings page  │                   │
     │<──────────────────│                   │
     │                   │                   │
```

## 7.2 OAuth Endpoints

### GHL OAuth URLs
- **Authorization URL**: `https://marketplace.gohighlevel.com/oauth/chooselocation`
- **Token URL**: `https://services.leadconnectorhq.com/oauth/token`
- **API Base URL**: `https://services.leadconnectorhq.com`

## 7.3 Implementation Code

### `/app/api/oauth/route.ts` - OAuth Initiation

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GHL_CLIENT_ID;
  const redirectUri = process.env.GHL_REDIRECT_URI;

  const scopes = [
    'payments/orders.readonly',
    'payments/orders.write',
    'payments/transactions.readonly',
    'payments/custom-provider.readonly',
    'payments/custom-provider.write',
  ].join(' ');

  const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId!);
  authUrl.searchParams.set('redirect_uri', redirectUri!);
  authUrl.searchParams.set('scope', scopes);

  return NextResponse.redirect(authUrl.toString());
}
```

### `/app/api/oauth/callback/route.ts` - OAuth Callback

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: process.env.GHL_CLIENT_ID!,
        client_secret: process.env.GHL_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.GHL_REDIRECT_URI!,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 });
    }

    const tokens = await tokenResponse.json();

    /*
    tokens structure:
    {
      access_token: string,
      refresh_token: string,
      expires_in: number,
      token_type: 'Bearer',
      scope: string,
      locationId: string,
      companyId: string,
      userId: string
    }
    */

    // Store installation in database
    const supabase = createClient();

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error: dbError } = await supabase
      .from('ghl_installations')
      .upsert({
        location_id: tokens.locationId,
        company_id: tokens.companyId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'location_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to store installation' }, { status: 500 });
    }

    // Redirect to settings page with locationId
    const settingsUrl = new URL('/settings', request.url);
    settingsUrl.searchParams.set('locationId', tokens.locationId);

    return NextResponse.redirect(settingsUrl.toString());

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.json({ error: 'OAuth failed' }, { status: 500 });
  }
}
```

### Token Refresh Helper

```typescript
// /lib/ghl/oauth.ts

export async function refreshAccessToken(locationId: string): Promise<string> {
  const supabase = createClient();

  // Get current installation
  const { data: installation, error } = await supabase
    .from('ghl_installations')
    .select('*')
    .eq('location_id', locationId)
    .single();

  if (error || !installation) {
    throw new Error('Installation not found');
  }

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(installation.token_expires_at);
  if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return installation.access_token;
  }

  // Refresh the token
  const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: process.env.GHL_CLIENT_ID!,
      client_secret: process.env.GHL_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: installation.refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await response.json();

  // Update database
  await supabase
    .from('ghl_installations')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('location_id', locationId);

  return tokens.access_token;
}
```

---

# 8. Settings Page (Custom Page)

## 8.1 Overview

The settings page is where users enter their Razorpay/Cashfree API credentials after installing the app. This page loads inside GHL in an iframe via the "Custom Page" feature.

## 8.2 URL Structure

```
https://your-domain.vercel.app/settings?locationId=xxx
```

GHL passes the `locationId` as a query parameter.

## 8.3 Implementation

### `/app/settings/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Credentials {
  gateway: 'razorpay' | 'cashfree';
  isTestMode: boolean;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  cashfreeAppId?: string;
  cashfreeSecretKey?: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const locationId = searchParams.get('locationId');

  const [gateway, setGateway] = useState<'razorpay' | 'cashfree'>('razorpay');
  const [isTestMode, setIsTestMode] = useState(true);
  const [credentials, setCredentials] = useState<Credentials>({
    gateway: 'razorpay',
    isTestMode: true,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Load existing credentials on mount
  useEffect(() => {
    if (locationId) {
      loadCredentials();
    }
  }, [locationId]);

  async function loadCredentials() {
    try {
      const response = await fetch(`/api/credentials?locationId=${locationId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.credentials) {
          setCredentials(data.credentials);
          setGateway(data.credentials.gateway);
          setIsTestMode(data.credentials.isTestMode);
        }
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          gateway,
          isTestMode,
          ...credentials,
        }),
      });

      if (response.ok) {
        setMessage('Credentials saved successfully!');
      } else {
        const error = await response.json();
        setMessage(`Error: ${error.message}`);
      }
    } catch (error) {
      setMessage('Failed to save credentials');
    } finally {
      setLoading(false);
    }
  }

  if (!locationId) {
    return (
      <div className="p-8">
        <p className="text-red-500">Error: No location ID provided</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Payment Gateway Settings</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
          {/* Gateway Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Select Payment Gateway
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gateway"
                  value="razorpay"
                  checked={gateway === 'razorpay'}
                  onChange={() => setGateway('razorpay')}
                  className="mr-2"
                />
                Razorpay
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="gateway"
                  value="cashfree"
                  checked={gateway === 'cashfree'}
                  onChange={() => setGateway('cashfree')}
                  className="mr-2"
                />
                Cashfree
              </label>
            </div>
          </div>

          {/* Test Mode Toggle */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isTestMode}
                onChange={(e) => setIsTestMode(e.target.checked)}
                className="mr-2"
              />
              Test Mode (use sandbox/test credentials)
            </label>
          </div>

          {/* Razorpay Credentials */}
          {gateway === 'razorpay' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={credentials.razorpayKeyId || ''}
                  onChange={(e) => setCredentials({
                    ...credentials,
                    razorpayKeyId: e.target.value
                  })}
                  placeholder="rzp_test_xxxxxxxxxx"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  value={credentials.razorpayKeySecret || ''}
                  onChange={(e) => setCredentials({
                    ...credentials,
                    razorpayKeySecret: e.target.value
                  })}
                  placeholder="Enter your Razorpay secret key"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>
          )}

          {/* Cashfree Credentials */}
          {gateway === 'cashfree' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cashfree App ID
                </label>
                <input
                  type="text"
                  value={credentials.cashfreeAppId || ''}
                  onChange={(e) => setCredentials({
                    ...credentials,
                    cashfreeAppId: e.target.value
                  })}
                  placeholder="Enter your Cashfree App ID"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Cashfree Secret Key
                </label>
                <input
                  type="password"
                  value={credentials.cashfreeSecretKey || ''}
                  onChange={(e) => setCredentials({
                    ...credentials,
                    cashfreeSecretKey: e.target.value
                  })}
                  placeholder="Enter your Cashfree secret key"
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>

          {/* Message */}
          {message && (
            <p className={`mt-4 text-center ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {message}
            </p>
          )}
        </form>

        {/* Help Text */}
        <div className="mt-6 text-sm text-gray-600">
          <h3 className="font-medium mb-2">Where to find your credentials:</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Razorpay:</strong> Dashboard → Settings → API Keys
            </li>
            <li>
              <strong>Cashfree:</strong> Dashboard → Developers → API Keys
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### `/app/api/credentials/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/encryption';

// GET - Load existing credentials
export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');

  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('payment_credentials')
    .select('*')
    .eq('location_id', locationId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ credentials: null });
  }

  // Don't return secrets, just indicate they're set
  return NextResponse.json({
    credentials: {
      gateway: data.gateway,
      isTestMode: data.is_test_mode,
      razorpayKeyId: data.razorpay_key_id,
      razorpayKeySecret: data.razorpay_key_secret ? '••••••••' : '',
      cashfreeAppId: data.cashfree_app_id,
      cashfreeSecretKey: data.cashfree_secret_key ? '••••••••' : '',
    }
  });
}

// POST - Save credentials
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { locationId, gateway, isTestMode, razorpayKeyId, razorpayKeySecret, cashfreeAppId, cashfreeSecretKey } = body;

  if (!locationId || !gateway) {
    return NextResponse.json({ error: 'locationId and gateway required' }, { status: 400 });
  }

  const supabase = createClient();

  // Verify installation exists
  const { data: installation } = await supabase
    .from('ghl_installations')
    .select('id')
    .eq('location_id', locationId)
    .single();

  if (!installation) {
    return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
  }

  // Prepare data (encrypt secrets)
  const credentialData: any = {
    location_id: locationId,
    gateway,
    is_test_mode: isTestMode,
    updated_at: new Date().toISOString(),
  };

  if (gateway === 'razorpay') {
    credentialData.razorpay_key_id = razorpayKeyId;
    if (razorpayKeySecret && !razorpayKeySecret.includes('••••')) {
      credentialData.razorpay_key_secret = encrypt(razorpayKeySecret);
    }
    // Clear Cashfree credentials
    credentialData.cashfree_app_id = null;
    credentialData.cashfree_secret_key = null;
  } else {
    credentialData.cashfree_app_id = cashfreeAppId;
    if (cashfreeSecretKey && !cashfreeSecretKey.includes('••••')) {
      credentialData.cashfree_secret_key = encrypt(cashfreeSecretKey);
    }
    // Clear Razorpay credentials
    credentialData.razorpay_key_id = null;
    credentialData.razorpay_key_secret = null;
  }

  const { error } = await supabase
    .from('payment_credentials')
    .upsert(credentialData, {
      onConflict: 'location_id,gateway'
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

# 9. Payments URL (Checkout Page)

## 9.1 Overview

The `paymentsUrl` is the checkout page that GHL loads inside an iframe when a customer needs to make a payment. This page:

1. Signals to GHL that it's ready
2. Receives payment details from GHL
3. Opens Razorpay/Cashfree checkout
4. Reports success/failure back to GHL

## 9.2 GHL Communication Protocol

### Events FROM GHL (your page listens):

```javascript
// GHL sends this after you dispatch 'custom_provider_ready'
window.addEventListener('message', (event) => {
  if (event.data.type === 'payment_initiate_props') {
    const paymentProps = event.data.payload;
    /*
    paymentProps structure:
    {
      publishableKey: string,      // From payment provider config
      apiKey: string,              // From payment provider config (for backend)
      amount: number,              // Amount in smallest unit (paise)
      currency: string,            // 'INR'
      contact: {
        id: string,
        name: string,
        email: string,
        phone: string,
      },
      orderId: string,             // GHL order ID
      transactionId: string,       // GHL transaction ID
      locationId: string,          // Sub-account ID
      liveMode: boolean,           // true for live, false for test
    }
    */
  }
});
```

### Events TO GHL (your page dispatches):

```javascript
// 1. When your page is ready to receive payment details
window.parent.postMessage({ type: 'custom_provider_ready' }, '*');

// 2. When payment succeeds
window.parent.postMessage({
  type: 'custom_provider_payment_status',
  status: 'success',
  transactionId: 'ghl_transaction_id',
  chargeId: 'razorpay_payment_id', // Your gateway's payment ID
}, '*');

// 3. When payment fails
window.parent.postMessage({
  type: 'custom_provider_payment_status',
  status: 'failed',
  transactionId: 'ghl_transaction_id',
  error: 'Payment was declined',
}, '*');
```

## 9.3 Implementation

### `/app/checkout/page.tsx`

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';

interface PaymentProps {
  publishableKey: string;
  apiKey: string;
  amount: number;
  currency: string;
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  orderId: string;
  transactionId: string;
  locationId: string;
  liveMode: boolean;
}

interface GatewayConfig {
  gateway: 'razorpay' | 'cashfree';
  keyId?: string;
  appId?: string;
}

declare global {
  interface Window {
    Razorpay: any;
    Cashfree: any;
  }
}

export default function CheckoutPage() {
  const [paymentProps, setPaymentProps] = useState<PaymentProps | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [cashfreeLoaded, setCashfreeLoaded] = useState(false);

  // Listen for payment props from GHL
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'payment_initiate_props') {
        console.log('[Checkout] Received payment props:', event.data.payload);
        setPaymentProps(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal to GHL that we're ready
    window.parent.postMessage({ type: 'custom_provider_ready' }, '*');
    console.log('[Checkout] Dispatched custom_provider_ready');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch gateway config when we have locationId
  useEffect(() => {
    if (paymentProps?.locationId) {
      fetchGatewayConfig(paymentProps.locationId);
    }
  }, [paymentProps?.locationId]);

  // Start payment when everything is ready
  useEffect(() => {
    if (paymentProps && gatewayConfig && !processing) {
      if (gatewayConfig.gateway === 'razorpay' && razorpayLoaded) {
        initiateRazorpayPayment();
      } else if (gatewayConfig.gateway === 'cashfree' && cashfreeLoaded) {
        initiateCashfreePayment();
      }
    }
  }, [paymentProps, gatewayConfig, razorpayLoaded, cashfreeLoaded]);

  async function fetchGatewayConfig(locationId: string) {
    try {
      const response = await fetch(`/api/gateway-config?locationId=${locationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch gateway configuration');
      }
      const config = await response.json();
      setGatewayConfig(config);
    } catch (err) {
      setError('Payment gateway not configured. Please contact support.');
      reportFailure('Gateway not configured');
    }
  }

  function reportSuccess(chargeId: string) {
    window.parent.postMessage({
      type: 'custom_provider_payment_status',
      status: 'success',
      transactionId: paymentProps?.transactionId,
      chargeId: chargeId,
    }, '*');
  }

  function reportFailure(errorMessage: string) {
    window.parent.postMessage({
      type: 'custom_provider_payment_status',
      status: 'failed',
      transactionId: paymentProps?.transactionId,
      error: errorMessage,
    }, '*');
  }

  async function initiateRazorpayPayment() {
    if (!paymentProps || !gatewayConfig?.keyId) return;
    setProcessing(true);

    try {
      // Create order on backend first
      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: paymentProps.locationId,
          amount: paymentProps.amount,
          currency: paymentProps.currency,
          ghlTransactionId: paymentProps.transactionId,
          ghlOrderId: paymentProps.orderId,
          contact: paymentProps.contact,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const { orderId: razorpayOrderId, gateway } = await orderResponse.json();

      // Open Razorpay checkout
      const options = {
        key: gatewayConfig.keyId,
        amount: paymentProps.amount,
        currency: paymentProps.currency,
        name: 'Payment',
        description: `Order ${paymentProps.orderId}`,
        order_id: razorpayOrderId,
        prefill: {
          name: paymentProps.contact.name,
          email: paymentProps.contact.email,
          contact: paymentProps.contact.phone,
        },
        handler: function (response: any) {
          console.log('[Checkout] Razorpay success:', response);
          // Log transaction and report success
          logTransaction(response.razorpay_payment_id, 'success');
          reportSuccess(response.razorpay_payment_id);
        },
        modal: {
          ondismiss: function () {
            console.log('[Checkout] Razorpay modal dismissed');
            setProcessing(false);
            reportFailure('Payment cancelled by user');
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on('payment.failed', function (response: any) {
        console.error('[Checkout] Razorpay payment failed:', response.error);
        logTransaction(null, 'failed', response.error.description);
        reportFailure(response.error.description || 'Payment failed');
      });

      razorpay.open();

    } catch (err) {
      console.error('[Checkout] Error:', err);
      setError('Failed to initiate payment');
      reportFailure('Failed to initiate payment');
    }
  }

  async function initiateCashfreePayment() {
    if (!paymentProps || !gatewayConfig?.appId) return;
    setProcessing(true);

    try {
      // Create payment session on backend
      const sessionResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: paymentProps.locationId,
          amount: paymentProps.amount / 100, // Cashfree expects amount in rupees
          currency: paymentProps.currency,
          ghlTransactionId: paymentProps.transactionId,
          ghlOrderId: paymentProps.orderId,
          contact: paymentProps.contact,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create payment session');
      }

      const { paymentSessionId, orderId: cashfreeOrderId } = await sessionResponse.json();

      // Open Cashfree checkout
      const cashfree = window.Cashfree({
        mode: paymentProps.liveMode ? 'production' : 'sandbox',
      });

      const checkoutOptions = {
        paymentSessionId: paymentSessionId,
        redirectTarget: '_modal',
      };

      cashfree.checkout(checkoutOptions).then((result: any) => {
        if (result.error) {
          console.error('[Checkout] Cashfree error:', result.error);
          logTransaction(null, 'failed', result.error.message);
          reportFailure(result.error.message || 'Payment failed');
        } else if (result.paymentDetails) {
          const paymentStatus = result.paymentDetails.paymentMessage;
          if (paymentStatus === 'Payment Successful' || result.paymentDetails.paymentStatus === 'SUCCESS') {
            console.log('[Checkout] Cashfree success:', result.paymentDetails);
            logTransaction(result.paymentDetails.cfPaymentId, 'success');
            reportSuccess(result.paymentDetails.cfPaymentId);
          } else {
            logTransaction(null, 'failed', paymentStatus);
            reportFailure(paymentStatus || 'Payment failed');
          }
        }
      });

    } catch (err) {
      console.error('[Checkout] Error:', err);
      setError('Failed to initiate payment');
      reportFailure('Failed to initiate payment');
    }
  }

  async function logTransaction(paymentId: string | null, status: string, errorMessage?: string) {
    try {
      await fetch('/api/log-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: paymentProps?.locationId,
          ghlTransactionId: paymentProps?.transactionId,
          ghlOrderId: paymentProps?.orderId,
          gateway: gatewayConfig?.gateway,
          gatewayPaymentId: paymentId,
          amount: paymentProps?.amount,
          currency: paymentProps?.currency,
          status,
          errorMessage,
          contact: paymentProps?.contact,
        }),
      });
    } catch (err) {
      console.error('[Checkout] Failed to log transaction:', err);
    }
  }

  return (
    <>
      {/* Load Razorpay SDK */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />

      {/* Load Cashfree SDK */}
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        onLoad={() => setCashfreeLoaded(true)}
      />

      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          {error ? (
            <div className="text-red-500">
              <p className="text-lg font-medium">Payment Error</p>
              <p className="text-sm mt-2">{error}</p>
            </div>
          ) : (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">
                {processing ? 'Processing payment...' : 'Initializing payment...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

---

# 10. Query URL (Backend API)

## 10.1 Overview

The `queryUrl` is your backend endpoint that GHL calls for payment operations:
- **verify**: After payment, GHL calls this to confirm the payment was successful
- **refund**: When a refund is initiated from GHL, this processes it

## 10.2 Request/Response Format

### Verify Request

```json
{
  "type": "verify",
  "transactionId": "ghl_transaction_123",
  "chargeId": "razorpay_payment_id",
  "locationId": "location_456",
  "apiKey": "configured_api_key"
}
```

### Verify Response (Success)

```json
{
  "success": true,
  "chargeId": "razorpay_payment_id",
  "status": "succeeded",
  "amount": 50000,
  "currency": "INR",
  "chargeSnapshot": {
    "status": "succeeded",
    "amount": 50000,
    "chargeId": "razorpay_payment_id",
    "chargedAt": 1704067200
  }
}
```

### Verify Response (Failed)

```json
{
  "success": false,
  "error": "Payment not found or failed",
  "status": "failed"
}
```

### Refund Request

```json
{
  "type": "refund",
  "transactionId": "ghl_transaction_123",
  "chargeId": "razorpay_payment_id",
  "amount": 25000,
  "locationId": "location_456",
  "apiKey": "configured_api_key"
}
```

### Refund Response

```json
{
  "success": true,
  "refundId": "refund_123",
  "amount": 25000,
  "status": "processed"
}
```

## 10.3 Implementation

### `/app/api/query/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/encryption';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, locationId, apiKey } = body;

    console.log(`[QueryURL] Received ${type} request for location ${locationId}`);

    // Verify the API key matches what we have stored
    const supabase = createClient();
    const { data: credentials, error: credError } = await supabase
      .from('payment_credentials')
      .select('*')
      .eq('location_id', locationId)
      .single();

    if (credError || !credentials) {
      return NextResponse.json({
        success: false,
        error: 'Payment provider not configured',
      }, { status: 400 });
    }

    // Route to appropriate handler
    switch (type) {
      case 'verify':
        return handleVerify(body, credentials);
      case 'refund':
        return handleRefund(body, credentials);
      default:
        return NextResponse.json({
          success: false,
          error: `Unsupported operation: ${type}`,
        }, { status: 400 });
    }

  } catch (error) {
    console.error('[QueryURL] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

async function handleVerify(body: any, credentials: any) {
  const { chargeId, transactionId } = body;

  if (credentials.gateway === 'razorpay') {
    return verifyRazorpayPayment(chargeId, credentials);
  } else if (credentials.gateway === 'cashfree') {
    return verifyCashfreePayment(chargeId, credentials);
  }

  return NextResponse.json({
    success: false,
    error: 'Unknown gateway',
  }, { status: 400 });
}

async function verifyRazorpayPayment(paymentId: string, credentials: any) {
  try {
    const razorpay = new Razorpay({
      key_id: credentials.razorpay_key_id,
      key_secret: decrypt(credentials.razorpay_key_secret),
    });

    const payment = await razorpay.payments.fetch(paymentId);

    if (payment.status === 'captured') {
      return NextResponse.json({
        success: true,
        chargeId: payment.id,
        status: 'succeeded',
        amount: payment.amount,
        currency: payment.currency,
        chargeSnapshot: {
          status: 'succeeded',
          amount: payment.amount,
          chargeId: payment.id,
          chargedAt: Math.floor(payment.created_at),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'failed',
        error: `Payment status: ${payment.status}`,
      });
    }

  } catch (error: any) {
    console.error('[Verify] Razorpay error:', error);
    return NextResponse.json({
      success: false,
      status: 'failed',
      error: error.message || 'Failed to verify payment',
    });
  }
}

async function verifyCashfreePayment(paymentId: string, credentials: any) {
  try {
    const isTestMode = credentials.is_test_mode;
    const baseUrl = isTestMode
      ? 'https://sandbox.cashfree.com/pg'
      : 'https://api.cashfree.com/pg';

    // Fetch payment details from Cashfree
    const response = await fetch(`${baseUrl}/orders/${paymentId}/payments`, {
      headers: {
        'x-client-id': credentials.cashfree_app_id,
        'x-client-secret': decrypt(credentials.cashfree_secret_key),
        'x-api-version': '2023-08-01',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch payment from Cashfree');
    }

    const payments = await response.json();
    const payment = payments[0]; // Get first payment

    if (payment && payment.payment_status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        chargeId: payment.cf_payment_id,
        status: 'succeeded',
        amount: Math.round(payment.payment_amount * 100), // Convert to paise
        currency: payment.payment_currency,
        chargeSnapshot: {
          status: 'succeeded',
          amount: Math.round(payment.payment_amount * 100),
          chargeId: payment.cf_payment_id,
          chargedAt: Math.floor(new Date(payment.payment_time).getTime() / 1000),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'failed',
        error: `Payment status: ${payment?.payment_status || 'unknown'}`,
      });
    }

  } catch (error: any) {
    console.error('[Verify] Cashfree error:', error);
    return NextResponse.json({
      success: false,
      status: 'failed',
      error: error.message || 'Failed to verify payment',
    });
  }
}

async function handleRefund(body: any, credentials: any) {
  const { chargeId, amount, transactionId } = body;

  if (credentials.gateway === 'razorpay') {
    return processRazorpayRefund(chargeId, amount, credentials);
  } else if (credentials.gateway === 'cashfree') {
    return processCashfreeRefund(chargeId, amount, credentials, transactionId);
  }

  return NextResponse.json({
    success: false,
    error: 'Unknown gateway',
  }, { status: 400 });
}

async function processRazorpayRefund(paymentId: string, amount: number, credentials: any) {
  try {
    const razorpay = new Razorpay({
      key_id: credentials.razorpay_key_id,
      key_secret: decrypt(credentials.razorpay_key_secret),
    });

    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount, // Amount in paise
    });

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: 'processed',
    });

  } catch (error: any) {
    console.error('[Refund] Razorpay error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process refund',
    }, { status: 500 });
  }
}

async function processCashfreeRefund(orderId: string, amount: number, credentials: any, refundId: string) {
  try {
    const isTestMode = credentials.is_test_mode;
    const baseUrl = isTestMode
      ? 'https://sandbox.cashfree.com/pg'
      : 'https://api.cashfree.com/pg';

    const response = await fetch(`${baseUrl}/orders/${orderId}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': credentials.cashfree_app_id,
        'x-client-secret': decrypt(credentials.cashfree_secret_key),
        'x-api-version': '2023-08-01',
      },
      body: JSON.stringify({
        refund_amount: amount / 100, // Convert paise to rupees
        refund_id: refundId,
        refund_note: 'Refund from GHL',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Refund failed');
    }

    const refund = await response.json();

    return NextResponse.json({
      success: true,
      refundId: refund.cf_refund_id,
      amount: Math.round(refund.refund_amount * 100),
      status: 'processed',
    });

  } catch (error: any) {
    console.error('[Refund] Cashfree error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process refund',
    }, { status: 500 });
  }
}
```

---

# 11. Payment Flow Diagrams

## 11.1 Complete Payment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Customer │     │   GHL    │     │ Your App │     │ Gateway  │     │   GHL    │
│          │     │ Checkout │     │(paymentsUrl)│  │(Razorpay)│     │(queryUrl)│
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │                │
     │ 1. Click Pay   │                │                │                │
     │───────────────>│                │                │                │
     │                │                │                │                │
     │                │ 2. Load iframe │                │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │ 3. custom_provider_ready        │                │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │ 4. payment_initiate_props       │                │
     │                │───────────────>│                │                │
     │                │                │                │                │
     │                │                │ 5. Create order│                │
     │                │                │───────────────>│                │
     │                │                │                │                │
     │                │                │ 6. Order ID    │                │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │ 7. Open checkout modal          │                │
     │<────────────────────────────────│                │                │
     │                │                │                │                │
     │ 8. Enter payment details & pay  │                │                │
     │────────────────────────────────────────────────>│                │
     │                │                │                │                │
     │                │                │ 9. Payment result               │
     │                │                │<───────────────│                │
     │                │                │                │                │
     │                │ 10. custom_provider_payment_status (success)     │
     │                │<───────────────│                │                │
     │                │                │                │                │
     │                │ 11. Verify payment (POST to queryUrl)            │
     │                │─────────────────────────────────────────────────>│
     │                │                │                │                │
     │                │ 12. Confirm with gateway        │                │
     │                │                │                │<───────────────│
     │                │                │                │                │
     │                │ 13. Verification result         │                │
     │                │<─────────────────────────────────────────────────│
     │                │                │                │                │
     │ 14. Show success & redirect     │                │                │
     │<───────────────│                │                │                │
     │                │                │                │                │
```

## 11.2 Refund Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│GHL Admin │     │   GHL    │     │ Your App │     │ Gateway  │
│          │     │ Backend  │     │(queryUrl)│     │(Razorpay)│
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Initiate    │                │                │
     │    refund      │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │ 2. POST /query │                │
     │                │   type: refund │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │                │ 3. Process     │
     │                │                │    refund      │
     │                │                │───────────────>│
     │                │                │                │
     │                │                │ 4. Refund      │
     │                │                │    result      │
     │                │                │<───────────────│
     │                │                │                │
     │                │ 5. Refund      │                │
     │                │    response    │                │
     │                │<───────────────│                │
     │                │                │                │
     │ 6. Show refund │                │                │
     │    success     │                │                │
     │<───────────────│                │                │
     │                │                │                │
```

---

# 12. API Reference

## 12.1 Internal APIs (Your App)

### `POST /api/create-order`

Creates a payment order with the gateway.

**Request:**
```json
{
  "locationId": "string",
  "amount": 50000,
  "currency": "INR",
  "ghlTransactionId": "string",
  "ghlOrderId": "string",
  "contact": {
    "id": "string",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210"
  }
}
```

**Response (Razorpay):**
```json
{
  "orderId": "order_xxxxx",
  "gateway": "razorpay"
}
```

**Response (Cashfree):**
```json
{
  "orderId": "order_xxxxx",
  "paymentSessionId": "session_xxxxx",
  "gateway": "cashfree"
}
```

### `GET /api/gateway-config`

Returns gateway configuration for the checkout page.

**Query Params:** `locationId`

**Response:**
```json
{
  "gateway": "razorpay",
  "keyId": "rzp_test_xxxxx"
}
```

### `POST /api/log-transaction`

Logs transaction for debugging/audit.

**Request:**
```json
{
  "locationId": "string",
  "ghlTransactionId": "string",
  "ghlOrderId": "string",
  "gateway": "razorpay",
  "gatewayPaymentId": "pay_xxxxx",
  "amount": 50000,
  "currency": "INR",
  "status": "success",
  "contact": {...}
}
```

## 12.2 GHL APIs Used

### Get Location Info
```
GET https://services.leadconnectorhq.com/locations/{locationId}
Authorization: Bearer {access_token}
```

### Custom Provider Webhook (you send TO GHL)
```
POST https://backend.leadconnectorhq.com/payments/custom-provider/webhook

{
  "event": "payment.captured",
  "chargeId": "pay_xxxxx",
  "ghlTransactionId": "txn_xxxxx",
  "chargeSnapshot": {...},
  "locationId": "loc_xxxxx",
  "apiKey": "configured_key",
  "marketplaceAppId": "app_xxxxx"
}
```

---

# 13. Environment Variables

```env
# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# GHL OAuth
GHL_CLIENT_ID=your_ghl_client_id
GHL_CLIENT_SECRET=your_ghl_client_secret
GHL_REDIRECT_URI=https://your-domain.vercel.app/api/oauth/callback

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Encryption (for storing gateway secrets)
ENCRYPTION_KEY=32_character_encryption_key_here

# Optional: For server-side Razorpay operations
# (Individual credentials stored per installation in DB)
```

---

# 14. Step-by-Step Implementation Guide

## Phase 1: Project Setup (Day 1)

### Step 1.1: Create Next.js Project
```bash
npx create-next-app@latest ghl-payment-marketplace-app --typescript --tailwind --app
cd ghl-payment-marketplace-app
```

### Step 1.2: Install Dependencies
```bash
npm install razorpay @supabase/supabase-js
npm install -D @types/node
```

### Step 1.3: Set Up Supabase
1. Create new Supabase project
2. Run the SQL schema from Section 6
3. Get API keys

### Step 1.4: Configure Environment
Create `.env.local` with variables from Section 13

---

## Phase 2: GHL Developer Portal Setup (Day 2)

Follow all steps in Section 5 to:
1. Create Marketplace App
2. Configure OAuth
3. Set up Custom Page
4. Configure Payment Provider

---

## Phase 3: OAuth Implementation (Day 3)

### Step 3.1: Create OAuth Routes
- `/app/api/oauth/route.ts`
- `/app/api/oauth/callback/route.ts`

### Step 3.2: Create Token Refresh Helper
- `/lib/ghl/oauth.ts`

### Step 3.3: Test OAuth Flow
1. Install app on a test sub-account
2. Verify tokens are stored in database

---

## Phase 4: Settings Page (Day 4)

### Step 4.1: Create Settings Page
- `/app/settings/page.tsx`

### Step 4.2: Create Credentials API
- `/app/api/credentials/route.ts`

### Step 4.3: Add Encryption Helpers
- `/lib/encryption.ts`

### Step 4.4: Test Settings
1. Enter test credentials
2. Verify they're stored encrypted

---

## Phase 5: Checkout Page (Day 5-6)

### Step 5.1: Create Checkout Page
- `/app/checkout/page.tsx`

### Step 5.2: Create Order API
- `/app/api/create-order/route.ts`

### Step 5.3: Create Gateway Config API
- `/app/api/gateway-config/route.ts`

### Step 5.4: Test with GHL
1. Create a test order form in GHL
2. Attempt payment
3. Verify checkout loads and works

---

## Phase 6: Query URL (Day 7)

### Step 6.1: Create Query API
- `/app/api/query/route.ts`

### Step 6.2: Implement Verify
- Test verify with successful payment
- Test verify with failed payment

### Step 6.3: Implement Refund
- Test partial refund
- Test full refund

---

## Phase 7: Testing & Polish (Day 8-10)

### Step 7.1: End-to-End Testing
- Test Razorpay payments
- Test Cashfree payments
- Test refunds
- Test error scenarios

### Step 7.2: Error Handling
- Add proper error messages
- Add logging

### Step 7.3: UI Polish
- Improve settings page
- Improve checkout loading states

---

## Phase 8: Deployment & Submission (Day 11-14)

### Step 8.1: Deploy to Vercel
```bash
vercel --prod
```

### Step 8.2: Update GHL URLs
Update all URLs in GHL Developer Portal to production URLs

### Step 8.3: Submit for Review
1. Complete all GHL app requirements
2. Add screenshots
3. Submit for review

---

# 15. Testing Checklist

## OAuth Flow
- [ ] New installation redirects to GHL OAuth
- [ ] OAuth callback exchanges code for tokens
- [ ] Tokens stored in database
- [ ] Redirect to settings page works
- [ ] Token refresh works when expired

## Settings Page
- [ ] Page loads with locationId
- [ ] Can select Razorpay gateway
- [ ] Can select Cashfree gateway
- [ ] Can toggle test/live mode
- [ ] Credentials save successfully
- [ ] Credentials load on page revisit
- [ ] Validation for empty fields

## Checkout (Razorpay)
- [ ] Iframe loads in GHL
- [ ] `custom_provider_ready` dispatched
- [ ] `payment_initiate_props` received
- [ ] Razorpay order created
- [ ] Razorpay modal opens
- [ ] Successful payment reports success to GHL
- [ ] Failed payment reports failure to GHL
- [ ] Modal dismiss reports cancellation

## Checkout (Cashfree)
- [ ] Iframe loads in GHL
- [ ] `custom_provider_ready` dispatched
- [ ] `payment_initiate_props` received
- [ ] Cashfree session created
- [ ] Cashfree modal opens
- [ ] Successful payment reports success to GHL
- [ ] Failed payment reports failure to GHL

## Query URL
- [ ] Verify endpoint validates Razorpay payment
- [ ] Verify endpoint validates Cashfree payment
- [ ] Verify returns correct chargeSnapshot format
- [ ] Refund endpoint processes Razorpay refund
- [ ] Refund endpoint processes Cashfree refund
- [ ] Partial refunds work

## GHL Integration
- [ ] App appears in Payments > Integrations
- [ ] Can set as default payment provider
- [ ] Order Forms accept payments
- [ ] Invoices accept payments
- [ ] Payment Links work
- [ ] Transaction shows in GHL Payments

## Error Handling
- [ ] Invalid locationId handled
- [ ] Missing credentials handled
- [ ] Gateway API errors handled
- [ ] Network errors handled

---

# 16. Deployment Guide

## 16.1 Vercel Deployment

### Step 1: Connect Repository
1. Push code to GitHub
2. Go to vercel.com
3. Import project from GitHub

### Step 2: Configure Environment Variables
Add all environment variables from Section 13 in Vercel dashboard

### Step 3: Deploy
```bash
vercel --prod
```

### Step 4: Custom Domain (Optional)
1. Add custom domain in Vercel
2. Update DNS records
3. Update all URLs in GHL Developer Portal

## 16.2 Post-Deployment

1. Update GHL Developer Portal URLs:
   - Redirect URL
   - Custom Page URL
   - queryUrl
   - paymentsUrl

2. Test full flow with production URLs

3. Submit app for GHL review

---

# 17. Troubleshooting

## Common Issues

### OAuth Callback Fails
- **Cause**: Incorrect redirect URI
- **Fix**: Ensure redirect URI in GHL exactly matches your app

### Checkout iframe doesn't load
- **Cause**: X-Frame-Options or CSP blocking
- **Fix**: Ensure no restrictive headers; GHL needs to embed your page

### Payment not verified
- **Cause**: API key mismatch or network issue
- **Fix**: Check credentials are stored correctly; check gateway API status

### Refund fails
- **Cause**: Invalid payment ID or insufficient balance
- **Fix**: Verify payment ID format; check gateway dashboard

### Token refresh fails
- **Cause**: Refresh token expired or revoked
- **Fix**: User needs to reinstall the app

## Debug Logging

Add comprehensive logging:
```typescript
console.log('[Component] Action:', data);
```

Check Vercel logs:
```bash
vercel logs --follow
```

## GHL Support

For GHL-specific issues:
- Developer documentation: https://marketplace.gohighlevel.com/docs
- Support: https://help.gohighlevel.com

---

# Appendix A: Type Definitions

```typescript
// /types/ghl.ts

export interface GHLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
  locationId: string;
  companyId: string;
  userId: string;
}

export interface PaymentInitiateProps {
  publishableKey: string;
  apiKey: string;
  amount: number;
  currency: string;
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  orderId: string;
  transactionId: string;
  locationId: string;
  liveMode: boolean;
}

export interface QueryRequest {
  type: 'verify' | 'refund';
  transactionId: string;
  chargeId: string;
  amount?: number;
  locationId: string;
  apiKey: string;
}

export interface ChargeSnapshot {
  status: 'succeeded' | 'failed' | 'pending';
  amount: number;
  chargeId: string;
  chargedAt: number;
}

export interface VerifyResponse {
  success: boolean;
  chargeId?: string;
  status: 'succeeded' | 'failed';
  amount?: number;
  currency?: string;
  chargeSnapshot?: ChargeSnapshot;
  error?: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}
```

---

# Appendix B: Encryption Helper

```typescript
// /lib/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'utf-8');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'utf-8');

  const [ivHex, tagHex, encrypted] = encryptedText.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

---

# Appendix C: Useful Links

- **GHL Developer Portal**: https://marketplace.gohighlevel.com
- **GHL API Documentation**: https://marketplace.gohighlevel.com/docs
- **GHL Custom Payment Provider Docs**: https://marketplace.gohighlevel.com/docs/marketplace-modules/Payments/index.html
- **GHL Support**: https://help.gohighlevel.com
- **Razorpay Documentation**: https://razorpay.com/docs/
- **Cashfree Documentation**: https://docs.cashfree.com/
- **Next.js Documentation**: https://nextjs.org/docs
- **Supabase Documentation**: https://supabase.com/docs
- **Vercel Documentation**: https://vercel.com/docs

---

**END OF SPECIFICATION DOCUMENT**

*This document should be used as a reference when building the GHL Marketplace Payment App in a new repository/session.*
