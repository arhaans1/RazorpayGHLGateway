# Setup: Webhooks & Subscriptions

What changed, and what you need to do to turn it on.

---

## 1. Run the migrations

In the Supabase SQL Editor, run these in order:

1. `migrations/002_transactions_and_webhooks.sql`
2. `migrations/003_subscriptions.sql`

They're safe to re-run (`IF NOT EXISTS` throughout).

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

6. Point a funnel route at the product with gateway **Razorpay**

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
