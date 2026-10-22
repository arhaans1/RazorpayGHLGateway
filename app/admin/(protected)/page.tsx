'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  adminFetch,
  formatAmount,
  formatRevenue,
  RevenueStat,
  revenueSortKey,
  Spinner,
  EmptyState,
  TypeBadge,
  DateRangePicker,
  describeRange,
} from '../components/ui';
import { DayRange, rangeFromParams, rangeQuery } from '@/lib/date-range';

interface Bucket {
  count: number;
  paid: number;
  failed: number;
  revenue: Record<string, number>;
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
  by_client: (Bucket & { client_id: string; name: string })[];
  by_price: (Bucket & {
    price_id: string;
    client_id: string;
    product_name: string;
    payment_type: string;
    amount_paise: number;
    currency: string;
  })[];
}

function successRate(bucket: Bucket): string {
  const attempted = bucket.paid + bucket.failed;
  if (attempted === 0) return '—';
  return `${Math.round((bucket.paid / attempted) * 100)}%`;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [range, setRange] = useState<DayRange>(() => rangeFromParams(searchParams));
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = rangeQuery(range);
    router.replace(`/admin?${q}`, { scroll: false });

    adminFetch<Overview>(`/api/admin/overview?${q}`)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError('');
        }
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    // A fast second click can land before the first response; drop the stale one.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const q = rangeQuery(range);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Payments across all clients and products &middot; {describeRange(range)}
          </p>
        </div>
      </div>

      <DateRangePicker value={range} onChange={setRange} />

      {error && (
        <div className="alert alert-error">
          {error}
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            If this mentions a missing table, run the SQL in <code>migrations/</code> in your
            Supabase SQL editor.
          </div>
        </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : data ? (
        <div style={{ opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s' }}>
          <DashboardBody data={data} q={q} />
        </div>
      ) : null}
    </>
  );
}

function DashboardBody({ data, q }: { data: Overview; q: string }) {
  const { totals, by_client, by_price } = data;

  const clientsByRevenue = [...by_client].sort(
    (a, b) => revenueSortKey(b.revenue) - revenueSortKey(a.revenue) || b.count - a.count
  );
  const topProducts = [...by_price]
    .filter((p) => p.count > 0)
    .sort((a, b) => revenueSortKey(b.revenue) - revenueSortKey(a.revenue) || b.paid - a.paid)
    .slice(0, 8);
  const clientNameOf = (id: string) => by_client.find((c) => c.client_id === id)?.name ?? id;

  return (
    <>
      {totals.truncated && (
        <div className="alert alert-info">
          This period has more than 5,000 transactions; totals cover the most recent 5,000.
          Narrow the range for exact figures.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Revenue</div>
          <RevenueStat revenue={totals.revenue} />
          <div className="stat-meta">{totals.paid} successful payments</div>
        </div>
        <div className="stat">
          <div className="stat-label">Checkouts</div>
          <div className="stat-value">{totals.count}</div>
          <div className="stat-meta">started in this period</div>
        </div>
        <div className="stat">
          <div className="stat-label">Success rate</div>
          <div className="stat-value">{successRate(totals)}</div>
          <div className="stat-meta">{totals.failed} failed</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active subscriptions</div>
          <div className="stat-value">{totals.active_subscriptions}</div>
          <div className="stat-meta">right now &middot; {totals.subscriptions} total</div>
        </div>
        <div className="stat">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{totals.clients}</div>
          <div className="stat-meta">{totals.products} products</div>
        </div>
        <div className="stat">
          <div className="stat-label">Live checkouts</div>
          <div className="stat-value">{totals.active_routes}</div>
          <div className="stat-meta">of {totals.routes} configured</div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Revenue by client</div>
            <Link href={`/admin/transactions?${q}`} className="btn btn-ghost btn-sm">
              View transactions &rarr;
            </Link>
          </div>

          {clientsByRevenue.length === 0 ? (
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
                  {clientsByRevenue.map((c) => (
                    <tr key={c.client_id}>
                      <td style={{ fontWeight: 550 }}>{c.name}</td>
                      <td className="num">{formatRevenue(c.revenue)}</td>
                      <td className="num">{c.paid}</td>
                      <td className="num">{c.failed}</td>
                      <td className="num">{successRate(c)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={`/admin/transactions?client_id=${encodeURIComponent(
                            c.client_id
                          )}&${q}`}
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
            <EmptyState
              title="No sales in this period"
              hint="Try a wider date range, or All time."
            />
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
                      <td className="num">{formatAmount(p.amount_paise, p.currency)}</td>
                      <td className="num">{formatRevenue(p.revenue)}</td>
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
