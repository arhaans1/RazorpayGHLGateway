'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adminFetch,
  formatAmount,
  describeBilling,
  Modal,
  Spinner,
  EmptyState,
  TypeBadge,
  GatewayBadge,
} from '../../components/ui';
import {
  methodsForPaymentType,
  describeHiddenMethods,
} from '@/lib/payment-providers/razorpay-methods';

interface Client {
  id: string;
  name: string;
}

interface Price {
  id: string;
  client_id: string;
  product_name: string;
  amount_paise: number;
  currency: string;
  thank_you_url: string;
  payment_type: string;
  razorpay_plan_id: string | null;
  billing_period: string | null;
  billing_interval: number | null;
  total_count: number | null;
  hidden_payment_methods: string[] | null;
  created_at: string;
}

interface FunnelRoute {
  id: number;
  hostname: string;
  path_prefix: string;
  client_id: string;
  price_id: string;
  gateway: 'razorpay' | 'cashfree';
  is_active: boolean;
}

const BLANK = {
  id: '',
  client_id: '',
  product_name: '',
  amount_rupees: '',
  currency: 'INR',
  thank_you_url: '',
  payment_type: 'one_time',
  billing_period: 'monthly',
  billing_interval: '1',
  total_count: '12',
  // The `as string[]` is load-bearing: a bare [] infers never[] under strict
  // mode, and every setForm({ ...form, hidden_payment_methods: [...] }) would
  // then fail to compile.
  hidden_payment_methods: [] as string[],
  // A product's checkout URL, edited here so it goes live in one step.
  hostname: '',
  path_prefix: '/checkout',
  gateway: 'razorpay',
  route_active: true,
};

export default function ProductsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [routes, setRoutes] = useState<FunnelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Price | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [planBusy, setPlanBusy] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [c, p, r] = await Promise.all([
        adminFetch<{ clients: Client[] }>('/api/admin/clients'),
        adminFetch<{ prices: Price[] }>('/api/admin/prices'),
        adminFetch<{ routes: FunnelRoute[] }>('/api/admin/funnel-routes'),
      ]);
      setClients(c.clients);
      setPrices(p.prices);
      setRoutes(r.routes);
      // Open every client group by default so nothing is hidden on first load.
      setExpanded(new Set(c.clients.map((x) => x.id)));
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /** Products bucketed under their owning client. */
  const grouped = useMemo(() => {
    const map = new Map<string, Price[]>();
    for (const client of clients) map.set(client.id, []);
    for (const price of prices) {
      if (!map.has(price.client_id)) map.set(price.client_id, []);
      map.get(price.client_id)!.push(price);
    }
    return map;
  }, [clients, prices]);

  /**
   * Routes for a product, oldest first.
   *
   * A product is sold on exactly one URL, but the table can hold more than one
   * per product. We edit the oldest and surface any extras rather than
   * pretending they aren't there.
   */
  const routesByPrice = useMemo(() => {
    const map = new Map<string, FunnelRoute[]>();
    for (const route of [...routes].sort((a, b) => a.id - b.id)) {
      if (!map.has(route.price_id)) map.set(route.price_id, []);
      map.get(route.price_id)!.push(route);
    }
    return map;
  }, [routes]);

  const primaryRouteFor = (priceId: string) => routesByPrice.get(priceId)?.[0];
  const extraRoutesFor = (priceId: string) => (routesByPrice.get(priceId) ?? []).slice(1);

  async function removeExtraRoute(routeId: number) {
    if (!confirm('Remove this extra checkout URL?')) return;
    try {
      await adminFetch(`/api/admin/funnel-routes?id=${routeId}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggle(clientId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  function openCreate(clientId?: string) {
    setEditing(null);
    setForm({
      ...BLANK,
      client_id: clientId || clients[0]?.id || '',
      // { ...BLANK } is a shallow copy, so every form would otherwise share
      // BLANK's one array instance. A fresh array keeps one product's
      // selection from leaking into the next "New product" dialog.
      hidden_payment_methods: [],
      hostname: '',
      path_prefix: '/checkout',
      gateway: 'razorpay',
      route_active: true,
    });
    setModalOpen(true);
  }

  function toggleHiddenMethod(method: string) {
    // Functional form: non-mutating, and correct if two toggles land in one
    // React batch.
    setForm((prev) => ({
      ...prev,
      hidden_payment_methods: prev.hidden_payment_methods.includes(method)
        ? prev.hidden_payment_methods.filter((m) => m !== method)
        : [...prev.hidden_payment_methods, method],
    }));
  }

  function openEdit(price: Price) {
    const route = primaryRouteFor(price.id);
    setEditing(price);
    setForm({
      id: price.id,
      client_id: price.client_id,
      product_name: price.product_name,
      // Rupees in the UI, paise in the database — operators think in rupees.
      amount_rupees: String((price.amount_paise ?? 0) / 100),
      currency: price.currency || 'INR',
      thank_you_url: price.thank_you_url || '',
      payment_type: price.payment_type || 'one_time',
      billing_period: price.billing_period || 'monthly',
      billing_interval: String(price.billing_interval || 1),
      total_count: price.total_count != null ? String(price.total_count) : '',
      hidden_payment_methods: price.hidden_payment_methods ?? [],
      hostname: route?.hostname ?? '',
      path_prefix: route?.path_prefix ?? '/checkout',
      gateway: route?.gateway ?? 'razorpay',
      route_active: route ? route.is_active : true,
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const rupees = Number(form.amount_rupees);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError('Enter a valid amount greater than zero.');
      setSaving(false);
      return;
    }

    const payload: any = {
      id: form.id.trim(),
      client_id: form.client_id,
      product_name: form.product_name.trim(),
      amount_paise: Math.round(rupees * 100),
      currency: form.currency,
      thank_you_url: form.thank_you_url.trim(),
      payment_type: form.payment_type,
      // Applies to both payment types, so it belongs in the base payload rather
      // than the subscription-only block below.
      hidden_payment_methods: form.hidden_payment_methods,
      // Saved in the same request as the product, so a new product cannot end
      // up existing but unreachable.
      route: {
        hostname: form.hostname.trim(),
        path_prefix: form.path_prefix.trim(),
        gateway: form.gateway,
        is_active: form.route_active,
      },
    };

    if (form.payment_type === 'subscription') {
      payload.billing_period = form.billing_period;
      payload.billing_interval = Number(form.billing_interval) || 1;
      payload.total_count = form.total_count ? Number(form.total_count) : null;
      if (editing) payload.razorpay_plan_id = editing.razorpay_plan_id;
    }

    try {
      await adminFetch('/api/admin/prices', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      await load();
      setNotice(editing ? 'Product updated.' : 'Product created.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(price: Price) {
    if (!confirm(`Delete "${price.product_name}"? Funnel routes using it will break.`)) return;

    try {
      await adminFetch(`/api/admin/prices?id=${encodeURIComponent(price.id)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createPlan(price: Price) {
    setPlanBusy(price.id);
    setError('');
    try {
      const res = await adminFetch<{ plan_id: string }>('/api/admin/prices/create-plan', {
        method: 'POST',
        body: JSON.stringify({ price_id: price.id }),
      });
      await load();
      setNotice(`Razorpay plan created: ${res.plan_id}`);
      setTimeout(() => setNotice(''), 5000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPlanBusy(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Prices and checkout redirects, grouped by client.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()} disabled={!clients.length}>
          + Add product
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState title="No clients yet" hint="Add a client before creating products." />
        </div>
      ) : (
        <div className="stack">
          {clients.map((client) => {
            const items = grouped.get(client.id) ?? [];
            const isOpen = expanded.has(client.id);

            return (
              <div className="group" key={client.id}>
                <button
                  className={`group-head ${isOpen ? 'open' : ''}`}
                  onClick={() => toggle(client.id)}
                >
                  <span className={`group-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                  <span className="group-name">{client.name}</span>
                  <span className="group-id">{client.id}</span>
                  <span className="spacer" />
                  <span className="badge badge-gray">
                    {items.length} {items.length === 1 ? 'product' : 'products'}
                  </span>
                  <span
                    className="btn btn-ghost btn-sm"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreate(client.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        e.preventDefault();
                        openCreate(client.id);
                      }
                    }}
                  >
                    + Add
                  </span>
                </button>

                {isOpen && (
                  <div className="group-body">
                    {items.length === 0 ? (
                      <EmptyState title="No products for this client yet" />
                    ) : (
                      <div className="table-wrap">
                        <table className="data fixed">
                          <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '11%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '12%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Price</th>
                              <th>Type</th>
                              <th>Billing</th>
                              <th>Checkout URL</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((price) => (
                              <tr key={price.id}>
                                <td>
                                  <div style={{ fontWeight: 550 }}>{price.product_name}</div>
                                  <div className="mono" style={{ color: 'var(--text-faint)' }}>
                                    {price.id}
                                  </div>
                                </td>
                                <td className="num">
                                  {formatAmount(price.amount_paise, price.currency)}
                                </td>
                                <td>
                                  <TypeBadge paymentType={price.payment_type} />
                                  {/* Surfaced here rather than as its own column:
                                      the colgroup widths already sum to 100%. */}
                                  {!!price.hidden_payment_methods?.length && (
                                    <div
                                      style={{
                                        marginTop: 4,
                                        fontSize: 12,
                                        color: 'var(--text-faint)',
                                      }}
                                      title={`Hidden at checkout: ${describeHiddenMethods(
                                        price.hidden_payment_methods
                                      )}`}
                                    >
                                      Hides: {describeHiddenMethods(price.hidden_payment_methods)}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div>{describeBilling(price)}</div>
                                  {price.payment_type === 'subscription' && (
                                    <div style={{ marginTop: 4 }}>
                                      {price.razorpay_plan_id ? (
                                        <span
                                          className="mono"
                                          style={{ color: 'var(--text-faint)' }}
                                        >
                                          {price.razorpay_plan_id}
                                        </span>
                                      ) : (
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          onClick={() => createPlan(price)}
                                          disabled={planBusy === price.id}
                                        >
                                          {planBusy === price.id
                                            ? 'Creating…'
                                            : 'Create plan in Razorpay'}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {(() => {
                                    const route = primaryRouteFor(price.id);
                                    const extras = extraRoutesFor(price.id).length;

                                    // No route means the product exists but no
                                    // page can sell it — the failure this page
                                    // used to hide.
                                    if (!route) {
                                      return <span className="badge badge-amber">Not live</span>;
                                    }

                                    return (
                                      <>
                                        <a
                                          href={`https://${route.hostname}${route.path_prefix}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="truncate mono"
                                          style={{ color: 'var(--blue)' }}
                                          title={`${route.hostname}${route.path_prefix}`}
                                        >
                                          {route.hostname}
                                          {route.path_prefix}
                                        </a>
                                        <div className="row" style={{ gap: 6, marginTop: 4 }}>
                                          <GatewayBadge gateway={route.gateway} />
                                          {!route.is_active && (
                                            <span className="badge badge-gray">Paused</span>
                                          )}
                                          {extras > 0 && (
                                            <span
                                              className="badge badge-amber"
                                              title="Extra URLs also point at this product"
                                            >
                                              +{extras} more
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openEdit(price)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => remove(price)}
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Edit product' : 'New product'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        <form onSubmit={save} className="stack">
          <div className="form-grid">
            <div className="field">
              <label className="label">Product ID</label>
              <input
                className="input input-mono"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="course-basic"
                disabled={!!editing}
                required
              />
              <span className="hint">
                {editing ? 'IDs cannot be changed.' : 'Short unique slug.'}
              </span>
            </div>

            <div className="field">
              <label className="label">Client</label>
              <select
                className="select"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                required
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Product name</label>
            <input
              className="input"
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              placeholder="Healing Switch Method"
              required
            />
            <span className="hint">Shown to the customer in the payment modal.</span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="1"
                value={form.amount_rupees}
                onChange={(e) => setForm({ ...form, amount_rupees: e.target.value })}
                placeholder="1499"
                required
              />
              <span className="hint">In rupees, not paise.</span>
            </div>

            <div className="field">
              <label className="label">Currency</label>
              <select
                className="select"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="label">Checkout URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input input-mono"
                style={{ flex: 2 }}
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                placeholder="lp.example.com"
              />
              <input
                className="input input-mono"
                style={{ flex: 1 }}
                value={form.path_prefix}
                onChange={(e) => setForm({ ...form, path_prefix: e.target.value })}
                placeholder="/checkout"
              />
            </div>
            <span className="hint">
              The page carrying the checkout snippet. Leave blank to take this product offline.
            </span>

            <div className="row" style={{ marginTop: 4 }}>
              <select
                className="select"
                style={{ width: 'auto', minWidth: 150 }}
                value={form.gateway}
                onChange={(e) => setForm({ ...form, gateway: e.target.value })}
              >
                <option value="razorpay">Razorpay</option>
                <option value="cashfree">Cashfree</option>
              </select>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.route_active}
                  onChange={(e) => setForm({ ...form, route_active: e.target.checked })}
                />
                Live
              </label>
            </div>

            {form.payment_type === 'subscription' && form.gateway === 'cashfree' && (
              <div className="alert alert-error" style={{ marginBottom: 0 }}>
                Cashfree cannot process subscriptions here. Switch the gateway to Razorpay, or this
                product will fail at checkout.
              </div>
            )}

            {editing && extraRoutesFor(editing.id).length > 0 && (
              <div className="alert alert-info" style={{ marginBottom: 0 }}>
                This product also has {extraRoutesFor(editing.id).length} other checkout URL
                {extraRoutesFor(editing.id).length === 1 ? '' : 's'}. Only the one above is edited
                here.
                {extraRoutesFor(editing.id).map((r) => (
                  <div className="row" key={r.id} style={{ marginTop: 6 }}>
                    <code className="mono">
                      {r.hostname}
                      {r.path_prefix}
                    </code>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeExtraRoute(r.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Thank-you URL</label>
            <input
              className="input"
              type="url"
              value={form.thank_you_url}
              onChange={(e) => setForm({ ...form, thank_you_url: e.target.value })}
              placeholder="https://lp.example.com/thank-you"
              required
            />
            <span className="hint">Where the customer lands after a successful payment.</span>
          </div>

          <div className="field">
            <label className="label">Payment type</label>
            <select
              className="select"
              value={form.payment_type}
              onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
            >
              <option value="one_time">One-time payment</option>
              <option value="subscription">Subscription (Razorpay only)</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Hide payment methods (Razorpay only)</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 6,
              }}
            >
              {methodsForPaymentType(form.payment_type).map((m) => (
                <label className="checkbox-row" key={m.key}>
                  <input
                    type="checkbox"
                    checked={form.hidden_payment_methods.includes(m.key)}
                    onChange={() => toggleHiddenMethod(m.key)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            <span className="hint">
              Ticked methods are hidden in the Razorpay modal. This is a display filter, not a
              block &mdash; leave everything unticked to show all methods enabled on the
              client&apos;s account.
            </span>

            {form.payment_type === 'subscription' &&
              form.hidden_payment_methods.includes('card') &&
              !form.hidden_payment_methods.includes('upi') && (
                <div className="alert alert-info" style={{ marginBottom: 0 }}>
                  With cards hidden, UPI AutoPay becomes the likely route &mdash; and it caps each
                  debit at &#8377;15,000. Above that, hide UPI too and leave eMandate, which goes up
                  to &#8377;1 crore.
                </div>
              )}
          </div>

          {form.payment_type === 'subscription' && (
            <>
              <div className="alert alert-info" style={{ marginBottom: 0 }}>
                Subscriptions run on Razorpay only, and the client&apos;s Razorpay account must have
                recurring payments enabled. Card and UPI AutoPay cap each debit at ₹15,000.
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="label">Billing period</label>
                  <select
                    className="select"
                    value={form.billing_period}
                    onChange={(e) => setForm({ ...form, billing_period: e.target.value })}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="field">
                  <label className="label">Every</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.billing_interval}
                    onChange={(e) => setForm({ ...form, billing_interval: e.target.value })}
                  />
                  <span className="hint">2 + monthly = every 2 months.</span>
                </div>

                <div className="field">
                  <label className="label">Total cycles</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.total_count}
                    onChange={(e) => setForm({ ...form, total_count: e.target.value })}
                    placeholder="12"
                  />
                  <span className="hint">How many times to charge.</span>
                </div>
              </div>

              {editing?.razorpay_plan_id && (
                <div className="hint">
                  Current plan: <span className="mono">{editing.razorpay_plan_id}</span>. Razorpay
                  plans are immutable — changing the amount or cycle clears this and you&apos;ll
                  create a new plan.
                </div>
              )}
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
