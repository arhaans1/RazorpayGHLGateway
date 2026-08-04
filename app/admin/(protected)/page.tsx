'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch, formatAmount, Spinner, EmptyState, TypeBadge } from '../components/ui';

interface Bucket {
  count: number;
  paid: number;
  failed: number;
  revenue_paise: number;
}

interface Overview {
  totals: Bucket & {
    clients: number;
    products: number;
    routes: number;
    active_routes: number;
    subscriptions: number;
    active_subscriptions: number;
    truncated: boolean;
  };
  last_30_days: Bucket;
  by_client: (Bucket & { client_id: string; name: string })[];
  by_price: (Bucket & {
    price_id: string;
    client_id: string;
    product_name: string;
    payment_type: string;
    amount_paise: number;
  })[];
}

function successRate(bucket: Bucket): string {
  const attempted = bucket.paid + bucket.failed;
  if (attempted === 0) return '—';
  return `${Math.round((bucket.paid / attempted) * 100)}%`;
}

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch<Overview>('/api/admin/overview')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="alert alert-error">
        {error}
        <div style={{ marginTop: 6, fontSize: 12.5 }}>
          If this mentions a missing table, run the SQL in <code>migrations/</code> in your
          Supabase SQL editor.
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { totals, last_30_days: recent, by_client, by_price } = data;

  const clientsWithActivity = [...by_client].sort((a, b) => b.revenue_paise - a.revenue_paise);
  const topProducts = [...by_price].sort((a, b) => b.revenue_paise - a.revenue_paise).slice(0, 8);
  const clientNameOf = (id: string) => by_client.find((c) => c.client_id === id)?.name ?? id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Payments across all clients and products.</p>
        </div>
      </div>

      {totals.truncated && (
        <div className="alert alert-info">
          Showing aggregates over the most recent 5,000 transactions.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Revenue collected</div>
          <div className="stat-value blue">{formatAmount(totals.revenue_paise)}</div>
          <div className="stat-meta">{totals.paid} successful payments</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last 30 days</div>
          <div className="stat-value">{formatAmount(recent.revenue_paise)}</div>
          <div className="stat-meta">{recent.paid} payments</div>
        </div>
        <div className="stat">
          <div className="stat-label">Success rate</div>
          <div className="stat-value">{successRate(totals)}</div>
          <div className="stat-meta">{totals.failed} failed</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active subscriptions</div>
          <div className="stat-value">{totals.active_subscriptions}</div>
          <div className="stat-meta">{totals.subscriptions} total</div>
        </div>
        <div className="stat">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{totals.clients}</div>
          <div className="stat-meta">{totals.products} products</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active routes</div>
          <div className="stat-value">{totals.active_routes}</div>
          <div className="stat-meta">of {totals.routes} configured</div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Revenue by client</div>
            <Link href="/admin/transactions" className="btn btn-ghost btn-sm">
              View transactions →
            </Link>
          </div>

          {clientsWithActivity.length === 0 ? (
            <EmptyState title="No clients yet" hint="Add a client to get started." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Revenue</th>
                    <th>Paid</th>
                    <th>Failed</th>
                    <th>Success</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithActivity.map((c) => (
                    <tr key={c.client_id}>
                      <td style={{ fontWeight: 550 }}>{c.name}</td>
                      <td className="num">{formatAmount(c.revenue_paise)}</td>
                      <td className="num">{c.paid}</td>
                      <td className="num">{c.failed}</td>
                      <td className="num">{successRate(c)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={`/admin/transactions?client_id=${encodeURIComponent(c.client_id)}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Top products</div>
          </div>

          {topProducts.length === 0 ? (
            <EmptyState title="No products yet" hint="Add a product under Products." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Revenue</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.price_id}>
                      <td style={{ fontWeight: 550 }}>{p.product_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{clientNameOf(p.client_id)}</td>
                      <td>
                        <TypeBadge paymentType={p.payment_type} />
                      </td>
                      <td className="num">{formatAmount(p.amount_paise)}</td>
                      <td className="num">{formatAmount(p.revenue_paise)}</td>
                      <td className="num">{p.paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
