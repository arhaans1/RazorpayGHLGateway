'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  adminFetch,
  formatAmount,
  Modal,
  Spinner,
  EmptyState,
  GatewayBadge,
  TypeBadge,
} from '../../components/ui';

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
  payment_type: string;
}

interface FunnelRoute {
  id: number;
  hostname: string;
  path_prefix: string;
  client_id: string;
  price_id: string;
  gateway: 'razorpay' | 'cashfree';
  is_active: boolean;
  created_at: string;
}

const BLANK = {
  hostname: '',
  path_prefix: '/checkout',
  client_id: '',
  price_id: '',
  gateway: 'razorpay',
  is_active: true,
};

export default function RoutesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [routes, setRoutes] = useState<FunnelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FunnelRoute | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

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
      setExpanded(new Set(c.clients.map((x) => x.id)));
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, FunnelRoute[]>();
    for (const client of clients) map.set(client.id, []);
    for (const route of routes) {
      if (!map.has(route.client_id)) map.set(route.client_id, []);
      map.get(route.client_id)!.push(route);
    }
    return map;
  }, [clients, routes]);

  /** Only the selected client's products can be attached to their route. */
  const pricesForClient = (clientId: string) => prices.filter((p) => p.client_id === clientId);

  const priceOf = (id: string) => prices.find((p) => p.id === id);

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
    setForm({ ...BLANK, client_id: clientId || clients[0]?.id || '' });
    setModalOpen(true);
  }

  function openEdit(route: FunnelRoute) {
    setEditing(route);
    setForm({
      hostname: route.hostname,
      path_prefix: route.path_prefix,
      client_id: route.client_id,
      price_id: route.price_id,
      gateway: route.gateway || 'razorpay',
      is_active: route.is_active,
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload: any = { ...form };
      if (editing) payload.id = editing.id;

      await adminFetch('/api/admin/funnel-routes', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });

      setModalOpen(false);
      await load();
      setNotice(editing ? 'Route updated.' : 'Route created.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(route: FunnelRoute) {
    try {
      await adminFetch('/api/admin/funnel-routes', {
        method: 'PATCH',
        body: JSON.stringify({ id: route.id, is_active: !route.is_active }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(route: FunnelRoute) {
    if (!confirm(`Delete the route for ${route.hostname}${route.path_prefix}?`)) return;

    try {
      await adminFetch(`/api/admin/funnel-routes?id=${route.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const selectablePrices = pricesForClient(form.client_id);

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Funnel routes</h1>
          <p className="page-subtitle">
            Maps a checkout page URL to the client, product and gateway that should handle it.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openCreate()} disabled={!clients.length}>
          + Add route
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState title="No clients yet" hint="Add a client and a product first." />
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
                    {items.length} {items.length === 1 ? 'route' : 'routes'}
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
                      <EmptyState title="No routes for this client yet" />
                    ) : (
                      <div className="table-wrap">
                        <table className="data fixed">
                          {/* Actions needs the widest share — it holds three
                              buttons and gets clipped below ~22%. */}
                          <colgroup>
                            <col style={{ width: '25%' }} />
                            <col style={{ width: '21%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '9%' }} />
                            <col style={{ width: '25%' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Checkout URL</th>
                              <th>Product</th>
                              <th>Amount</th>
                              <th>Gateway</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((route) => {
                              const price = priceOf(route.price_id);
                              return (
                                <tr key={route.id}>
                                  <td className="mono">
                                    {route.hostname}
                                    <span style={{ color: 'var(--blue)' }}>
                                      {route.path_prefix}
                                    </span>
                                  </td>
                                  <td>
                                    {price ? (
                                      <>
                                        <div>{price.product_name}</div>
                                        <div style={{ marginTop: 3 }}>
                                          <TypeBadge paymentType={price.payment_type} />
                                        </div>
                                      </>
                                    ) : (
                                      <span className="badge badge-red">Missing product</span>
                                    )}
                                  </td>
                                  <td className="num">
                                    {price ? formatAmount(price.amount_paise, price.currency) : '—'}
                                  </td>
                                  <td>
                                    <GatewayBadge gateway={route.gateway} />
                                  </td>
                                  <td>
                                    {route.is_active ? (
                                      <span className="badge badge-green">Active</span>
                                    ) : (
                                      <span className="badge badge-gray">Paused</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => toggleActive(route)}
                                    >
                                      {route.is_active ? 'Pause' : 'Activate'}
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => openEdit(route)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => remove(route)}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
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
        title={editing ? 'Edit route' : 'New route'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create route'}
            </button>
          </>
        }
      >
        <form onSubmit={save} className="stack">
          <div className="form-grid">
            <div className="field">
              <label className="label">Hostname</label>
              <input
                className="input input-mono"
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                placeholder="lp.example.com"
                required
              />
              <span className="hint">Domain only — no https://</span>
            </div>

            <div className="field">
              <label className="label">Path</label>
              <input
                className="input input-mono"
                value={form.path_prefix}
                onChange={(e) => setForm({ ...form, path_prefix: e.target.value })}
                placeholder="/checkout"
                required
              />
              <span className="hint">Must match the checkout page path exactly.</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="label">Client</label>
              <select
                className="select"
                value={form.client_id}
                onChange={(e) =>
                  // Products belong to a client, so switching client invalidates
                  // any product already picked.
                  setForm({ ...form, client_id: e.target.value, price_id: '' })
                }
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

            <div className="field">
              <label className="label">Product</label>
              <select
                className="select"
                value={form.price_id}
                onChange={(e) => setForm({ ...form, price_id: e.target.value })}
                disabled={!form.client_id}
                required
              >
                <option value="">
                  {form.client_id ? 'Select a product…' : 'Pick a client first'}
                </option>
                {selectablePrices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_name} — {formatAmount(p.amount_paise, p.currency)}
                  </option>
                ))}
              </select>
              {form.client_id && selectablePrices.length === 0 && (
                <span className="hint" style={{ color: 'var(--red)' }}>
                  This client has no products yet.
                </span>
              )}
            </div>
          </div>

          <div className="field">
            <label className="label">Payment gateway</label>
            <select
              className="select"
              value={form.gateway}
              onChange={(e) => setForm({ ...form, gateway: e.target.value })}
            >
              <option value="razorpay">Razorpay</option>
              <option value="cashfree">Cashfree</option>
            </select>
            <span className="hint">
              The client must have credentials saved for the gateway you choose. Subscription
              products require Razorpay.
            </span>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active — accept payments on this URL
          </label>
        </form>
      </Modal>
    </>
  );
}
