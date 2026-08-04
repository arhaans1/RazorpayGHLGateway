'use client';

import { useEffect, useState } from 'react';
import { adminFetch, Modal, Spinner, EmptyState, formatDate } from '../../components/ui';

interface Client {
  id: string;
  name: string;
  razorpay_key_id?: string;
  cashfree_app_id?: string;
  cashfree_env?: 'sandbox' | 'production';
  created_at: string;
  has_razorpay_key_secret: boolean;
  has_cashfree_secret_key: boolean;
  has_razorpay_webhook_secret: boolean;
  has_cashfree_webhook_secret: boolean;
}

/** Sent when a secret field is left untouched; the server ignores it. */
const MASK = '********';

const BLANK = {
  id: '',
  name: '',
  razorpay_key_id: '',
  razorpay_key_secret: '',
  razorpay_webhook_secret: '',
  cashfree_app_id: '',
  cashfree_secret_key: '',
  cashfree_webhook_secret: '',
  cashfree_env: 'production',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch<{ clients: Client[] }>('/api/admin/clients');
      setClients(data.clients);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK });
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      id: client.id,
      name: client.name,
      razorpay_key_id: client.razorpay_key_id || '',
      // Secrets are never sent to the browser. Show a mask so the operator can
      // tell one is set, and only overwrite if they type something new.
      razorpay_key_secret: client.has_razorpay_key_secret ? MASK : '',
      razorpay_webhook_secret: client.has_razorpay_webhook_secret ? MASK : '',
      cashfree_app_id: client.cashfree_app_id || '',
      cashfree_secret_key: client.has_cashfree_secret_key ? MASK : '',
      cashfree_webhook_secret: client.has_cashfree_webhook_secret ? MASK : '',
      cashfree_env: client.cashfree_env || 'production',
    });
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Blank optional text fields should clear the column, not store "".
    const payload: any = {
      ...form,
      id: form.id.trim(),
      name: form.name.trim(),
      razorpay_key_id: form.razorpay_key_id.trim() || null,
      cashfree_app_id: form.cashfree_app_id.trim() || null,
    };

    try {
      await adminFetch('/api/admin/clients', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      setModalOpen(false);
      await load();
      setNotice(editing ? 'Client updated.' : 'Client created.');
      setTimeout(() => setNotice(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(client: Client) {
    if (
      !confirm(
        `Delete "${client.name}"? This also deletes their products, routes and transaction history.`
      )
    )
      return;

    try {
      await adminFetch(`/api/admin/clients?id=${encodeURIComponent(client.id)}`, {
        method: 'DELETE',
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setNotice('Copied to clipboard.');
    setTimeout(() => setNotice(''), 2000);
  }

  if (loading) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">
            Each client uses their own payment gateway account and credentials.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Add client
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {clients.length === 0 ? (
        <div className="card">
          <EmptyState title="No clients yet" hint="Add your first client to get started." />
        </div>
      ) : (
        <div className="stack">
          {clients.map((client) => (
            <div className="card" key={client.id}>
              <div className="card-head">
                <div>
                  <div className="card-title">{client.name}</div>
                  <div className="group-id">{client.id}</div>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(client)}>
                    Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(client)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="card-pad">
                <div className="form-grid">
                  <div>
                    <div className="stat-label">Razorpay</div>
                    <div style={{ marginTop: 6 }}>
                      {client.razorpay_key_id ? (
                        <>
                          <span className="mono">{client.razorpay_key_id}</span>{' '}
                          {client.has_razorpay_key_secret ? (
                            <span className="badge badge-green">Secret set</span>
                          ) : (
                            <span className="badge badge-red">No secret</span>
                          )}
                        </>
                      ) : (
                        <span className="badge badge-gray">Not configured</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="stat-label">Cashfree</div>
                    <div style={{ marginTop: 6 }}>
                      {client.cashfree_app_id ? (
                        <>
                          <span className="mono">{client.cashfree_app_id}</span>{' '}
                          <span className="badge badge-gray">{client.cashfree_env}</span>
                        </>
                      ) : (
                        <span className="badge badge-gray">Not configured</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="stat-label">Added</div>
                    <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                      {formatDate(client.created_at)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div className="stat-label" style={{ marginBottom: 8 }}>
                    Webhook URLs — paste into this client&apos;s gateway dashboard
                  </div>

                  {[
                    {
                      label: 'Razorpay',
                      url: `${origin}/api/webhooks/razorpay/${client.id}`,
                      ok: client.has_razorpay_webhook_secret,
                      note: 'Needs a webhook secret saved here and in Razorpay.',
                    },
                    {
                      label: 'Cashfree',
                      url: `${origin}/api/webhooks/cashfree/${client.id}`,
                      ok: client.has_cashfree_secret_key || client.has_cashfree_webhook_secret,
                      note: 'Uses the Cashfree secret key unless a webhook secret is set.',
                    },
                  ].map((hook) => (
                    <div className="row" key={hook.label} style={{ marginBottom: 8 }}>
                      <span className="badge badge-gray" style={{ minWidth: 74 }}>
                        {hook.label}
                      </span>
                      <code
                        className="mono truncate"
                        style={{ maxWidth: 420, color: 'var(--text-muted)' }}
                        title={hook.url}
                      >
                        {hook.url}
                      </code>
                      <button className="btn btn-ghost btn-sm" onClick={() => copy(hook.url)}>
                        Copy
                      </button>
                      {hook.ok ? (
                        <span className="badge badge-green">Ready</span>
                      ) : (
                        <span className="badge badge-amber" title={hook.note}>
                          Secret missing
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.name}` : 'New client'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create client'}
            </button>
          </>
        }
      >
        <form onSubmit={save} className="stack">
          <div className="form-grid">
            <div className="field">
              <label className="label">Client ID</label>
              <input
                className="input input-mono"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="acme-coaching"
                disabled={!!editing}
                required
              />
            </div>
            <div className="field">
              <label className="label">Display name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Coaching"
                required
              />
            </div>
          </div>

          <div className="section-title" style={{ marginTop: 6, marginBottom: 0 }}>
            Razorpay
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label">Key ID</label>
              <input
                className="input input-mono"
                value={form.razorpay_key_id}
                onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
                placeholder="rzp_live_..."
              />
            </div>
            <div className="field">
              <label className="label">Key secret</label>
              <input
                className="input input-mono"
                type="password"
                value={form.razorpay_key_secret}
                onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
                placeholder="Key secret"
              />
            </div>
          </div>
          <div className="field">
            <label className="label">Webhook secret</label>
            <input
              className="input input-mono"
              type="password"
              value={form.razorpay_webhook_secret}
              onChange={(e) => setForm({ ...form, razorpay_webhook_secret: e.target.value })}
              placeholder="Any random string"
            />
            <span className="hint">
              Must match the secret set on the webhook in the client&apos;s Razorpay dashboard.
              Without it, payment confirmations are rejected.
            </span>
          </div>

          <div className="section-title" style={{ marginTop: 6, marginBottom: 0 }}>
            Cashfree
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label">App ID</label>
              <input
                className="input input-mono"
                value={form.cashfree_app_id}
                onChange={(e) => setForm({ ...form, cashfree_app_id: e.target.value })}
                placeholder="Cashfree App ID"
              />
            </div>
            <div className="field">
              <label className="label">Secret key</label>
              <input
                className="input input-mono"
                type="password"
                value={form.cashfree_secret_key}
                onChange={(e) => setForm({ ...form, cashfree_secret_key: e.target.value })}
                placeholder="Cashfree secret key"
              />
            </div>
            <div className="field">
              <label className="label">Environment</label>
              <select
                className="select"
                value={form.cashfree_env}
                onChange={(e) => setForm({ ...form, cashfree_env: e.target.value })}
              >
                <option value="production">Production</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>
          </div>

          {editing && (
            <div className="hint">
              Secret fields show <span className="mono">{MASK}</span> when already saved. Leave them
              as-is to keep the current value.
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
