# Setup: Webhooks & Subscriptions

What changed, and what you need to do to turn it on.

---

## 1. Run the migrations

In the Supabase SQL Editor, run these in order:

1. `migrations/002_transactions_and_webhooks.sql`
2. `migrations/003_subscriptions.sql`
3. `migrations/004_hidden_payment_methods.sql`

They're safe to re-run (`IF NOT EXISTS` throughout).

⚠️ **Run these before deploying the code.** If the app queries a column that
doesn't exist yet, Supabase errors on the price lookup and *every* checkout on
*every* funnel returns `price_not_found` — a total payment outage, not a
degraded feature. Migration first, verify the columns exist, then deploy.

This adds:

| Table | Purpose |
|---|---|
| `transactions` | One row per checkout attempt; status confirmed by webhook |
| `subscriptions` | One row per recurring subscription |
| `webhook_events` | Idempotency guard + audit trail for every webhook delivery |

and new columns on `clients` (webhook secrets) and `prices` (recurring config).

---

## 2. Configure a webhook per client

**This is required.** Without it, payments stay stuck at `created` in the admin
panel — the gateway never tells the server the payment succeeded.

Each client has their own Razorpay/Cashfree account, so each needs their own
webhook pointing at their own URL. The URLs are shown on **Admin → Clients**
with a copy button.

### Razorpay (per client)

1. Log into **that client's** Razorpay dashboard
2. Settings → Webhooks → Add New Webhook
3. **URL:** `https://<your-app>/api/webhooks/razorpay/<client_id>`
4. **Secret:** any random string — generate one, e.g. `openssl rand -hex 24`
5. **Active events:**
   - `payment.captured`
   - `payment.failed`
   - For subscriptions also: `subscription.activated`, `subscription.charged`,
     `subscription.halted`, `subscription.cancelled`, `subscription.completed`,
     `subscription.pending`
6. Save, then paste the **same secret** into Admin → Clients → Edit → *Razorpay
   webhook secret*

The badge next to the URL turns from **Secret missing** to **Ready** once saved.

### Cashfree (per client)

1. Log into that client's Cashfree dashboard
2. Developers → Webhooks → Add endpoint
3. **URL:** `https://<your-app>/api/webhooks/cashfree/<client_id>`
4. Cashfree signs with the account secret key, which you've already saved, so no
   extra secret is needed unless you configure a dedicated one.

### Why the client id is in the URL

A webhook payload doesn't say which tenant it belongs to, and the signature
can't be verified without first knowing which secret to check against. Putting
the client id in the path resolves the tenant before verification.

---

## 3. Creating a subscription product

1. **Admin → Products → Add product**
2. Set **Payment type** to *Subscription*
3. Choose the billing period, interval and total cycles
4. Save
5. Back on the product row, click **Create plan in Razorpay**

Step 5 creates the plan inside that client's Razorpay account and stores the
plan id. A subscription cannot be created without it — checkout will return a
clear error telling you to do this.

6. Set the **Checkout URL** and gateway in the same modal, with gateway
   **Razorpay** — subscriptions cannot run on Cashfree

### Checkout URLs live on the product

There is no separate Routes tab. Each product carries its own checkout URL,
gateway and live toggle, saved in the same request as the product — so a new
product cannot end up existing but unreachable.

A product with no URL shows a **Not live** badge in the products table. That
used to be a silent failure: the product existed, no page could sell it, and you
only found out when a customer hit a dead checkout.

The `funnel_routes` table is unchanged — it is still what every checkout queries
to resolve a URL to a client and product. Only the editing UI moved. The table
can technically hold several URLs per product; if one ever does, the product
modal lists the extras with a Remove button rather than hiding them.

### Before it will work

Razorpay Subscriptions is **not enabled by default**. The client must contact
Razorpay support to enable recurring payments on their account.

### Limits worth knowing

| Method | Max per recurring debit |
|---|---|
| Cards, UPI AutoPay | ₹15,000 (₹1,00,000 for some merchant categories) |
| e-Mandate (bank account) | ₹1,00,00,000 |

If a subscription price is above ₹15,000/cycle, card and UPI will fail and
e-Mandate is the only option.

### Not supported

- **Cashfree subscriptions** — recurring is Razorpay-only here. Selecting
  Cashfree for a subscription product returns an explicit error rather than
  silently charging once.
- **Changing a plan's amount or cycle.** Razorpay plans are immutable. Editing
  those fields clears the stored plan id so you create a fresh plan; existing
  subscribers stay on the old plan.

---

## 4. What the admin panel now shows

- **Dashboard** — revenue, success rate, active subscriptions, per-client and
  per-product breakdowns
- **Products / Routes** — grouped under each client, collapsible
- **Transactions** — every attempt, filterable by client, product, status,
  gateway and payment type; searchable by customer name or email

---

## 5. Security change worth noting

Admin pages previously read and wrote Supabase **directly from the browser using
the public anon key**. That key ships in the JavaScript bundle, so anyone who
opened devtools could have read the `clients` table — including every client's
Razorpay and Cashfree secret keys.

All admin data access now goes through server-side `/api/admin/*` routes that
use the service-role key and check the `admin_auth` cookie. Secrets are never
sent to the browser; the UI only receives a boolean for whether each secret is
set.

**Recommended follow-up:** rotate any gateway credentials that were in the
database before this change, since they were previously exposed. The new
`transactions`, `subscriptions` and `webhook_events` tables have RLS enabled
with no permissive policy, so the anon key cannot read them at all.

Two things still outstanding that this change did not address:

- `clients`, `prices` and `funnel_routes` still have RLS disabled. Enabling it
  is now safe because nothing reads them with the anon key any more — but verify
  in a staging project first.
- Admin auth is still a single shared password with a plaintext comparison, and
  the cookie is a static `admin_auth=true` that doesn't expire on the server.

---

## 6. Backward compatibility

Checkout snippets already deployed on client landing pages keep working
unchanged. The API response still returns `order_id` and `checkout_data.order_id`
for one-time payments exactly as before; subscription support is additive.

You only need to re-copy the snippet (Admin → Checkout Code) on pages that
should sell a **subscription** product, since those need the `subscription_id`
branch.

---

## 7. Restricting payment methods per product

Each product can hide specific payment methods at checkout — useful when a
high-value subscription should go through eMandate only, and card/UPI would just
confuse buyers or fail.

### Setup

1. Run `migrations/004_hidden_payment_methods.sql` in the Supabase SQL editor
2. **Admin → Products → Edit** a product
3. Under **Hide payment methods**, tick what to hide
4. Save, then **re-paste the snippet** on that product's checkout page
   (Admin → Checkout Code)

The checkbox set changes with payment type. Subscriptions offer UPI AutoPay,
Cards, eMandate and NACH; one-time products offer UPI, Cards, Netbanking,
Wallets, Pay Later and EMI.

Netbanking is deliberately absent from the subscription list: in a recurring flow
Razorpay surfaces bank debit under its own key (`emandate`), so a netbanking tick
there would either do nothing or — because eMandate rides netbanking rails at the
bank — silently break the flow it was meant to protect.

### The re-paste requirement

Restrictions are applied in Checkout.js options, and the snippet is pasted into
landing pages by hand. **An already-deployed page keeps whatever snippet version
was pasted into it** and will ignore restrictions until re-pasted.

To check a live page, open its console. Current snippets log:

```
[Payment Gateway Checkout] v2 (method restrictions) script tag parsed and executing
```

No `v2` means that page predates this feature.

### Why not the dashboard's Payment Configuration ID

Razorpay's saved configurations are applied via `checkout_config_id` on the
**Orders** API. `POST /v1/subscriptions` does not accept that field — its
parameters are `plan_id`, `total_count`, `quantity`, `customer_notify`,
`start_at`, `expire_by`, `addons`, `notes`, `offer_id`. So a dashboard
configuration cannot reach a subscription checkout at all. Driving it from
checkout options is the only route that covers both payment types.

The gateway sends **both** of Razorpay's option-level mechanisms
(`options.method` booleans and `options.config.display.hide`) because they are
independent and either can be ignored depending on the flow.

### If the card tab survives anyway

Hiding is a **display filter, not a block**. It cannot disable a method on the
account, and anyone with devtools can strip it.

Razorpay treats card standing-instructions as a recurring fallback and may keep
showing a Cards tab regardless. If that happens, the remaining lever is outside
this codebase: raise a Razorpay support ticket to disable Card and UPI for
**Subscriptions** on the account. Subscription payment methods cannot be toggled
from the dashboard — support has to do it.
