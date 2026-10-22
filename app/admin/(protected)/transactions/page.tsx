'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DayRange, rangeFromParams, rangeQuery } from '@/lib/date-range';
import {
  adminFetch,
  formatAmount,
  formatDate,
  Spinner,
  EmptyState,
  StatusBadge,
  GatewayBadge,
  TypeBadge,
  DateRangePicker,
  describeRange,
  formatRevenue,
  RevenueStat,
} from '../../components/ui';

interface Transaction {
  id: number;
  client_id: string;
  price_id: string | null;
  gateway: string;
  payment_type: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  status: string;
  amount_paise: number;
  currency: string;
  customer_name: string | null;
  customer_email: string | null;
  product_name: string | null;
  error_message: string | null;
  created_at: string;
  paid_at: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface Summary {
  count: number;
  paid: number;
  failed: number;
  revenue: Record<string, number>;
  truncated: boolean;
}

const PAGE_SIZE = 50;

/**
 * useSearchParams needs a Suspense boundary or the App Router refuses to
 * prerender this route at build time.
 */
export default function TransactionsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Carried over from the dashboard's "Details"/"View transactions" links.
  const [range, setRangeState] = useState<DayRange>(() => rangeFromParams(searchParams));
  const [summary, setSummary] = useState<Summary | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    client_id: searchParams.get('client_id') || '',
    status: '',
    gateway: '',
    payment_type: '',
    q: '',
  });

  useEffect(() => {
    adminFetch<{ clients: Client[] }>('/api/admin/clients')
      .then((d) => setClients(d.clients))
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);

      const data = await adminFetch<{
        transactions: Transaction[];
        total: number;
        summary: Summary;
      }>(`/api/admin/transactions?${params}`);
      setRows(data.transactions);
      setTotal(data.total);
      setSummary(data.summary);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, offset, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the URL in step so a refresh or shared link reopens the same view.
  useEffect(() => {
    const parts = [rangeQuery(range)];
    if (filters.client_id) parts.unshift(`client_id=${encodeURIComponent(filters.client_id)}`);
    router.replace(`/admin/transactions?${parts.join('&')}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, filters.client_id]);

  function setRange(next: DayRange) {
    setOffset(0);
    setRangeState(next);
  }

  /** Changing any filter must reset paging, or page 3 of the old result set leaks through. */
  function setFilter(key: string, value: string) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">
            Every checkout attempt &middot; {describeRange(range)}. Status is confirmed by gateway
            webhooks.
          </p>
        </div>
      </div>

      <DateRangePicker value={range} onChange={setRange} />

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Revenue</div>
            <RevenueStat revenue={summary.revenue} />
            <div className="stat-meta">from paid transactions shown below</div>
          </div>
          <div className="stat">
            <div className="stat-label">Transactions</div>
            <div className="stat-value">{summary.count}</div>
            <div className="stat-meta">matching these filters</div>
          </div>
          <div className="stat">
            <div className="stat-label">Paid</div>
            <div className="stat-value">{summary.paid}</div>
            <div className="stat-meta">
              {summary.paid + summary.failed > 0
                ? `${Math.round((summary.paid / (summary.paid + summary.failed)) * 100)}% success`
                : 'no completed attempts'}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Failed</div>
            <div className="stat-value">{summary.failed}</div>
            <div className="stat-meta">
              {summary.count - summary.paid - summary.failed} still pending
            </div>
          </div>
        </div>
      )}
      {summary?.truncated && (
        <div className="alert alert-info">
          Totals cover the most recent 5,000 matching transactions. Narrow the range for exact
          figures.
        </div>
      )}

      <div className="filter-bar">
        <select
          className="select"
          value={filters.client_id}
          onChange={(e) => setFilter('client_id', e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">Any status</option>
          <option value="paid">Paid</option>
          <option value="created">Created</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          className="select"
          value={filters.gateway}
          onChange={(e) => setFilter('gateway', e.target.value)}
        >
          <option value="">Any gateway</option>
          <option value="razorpay">Razorpay</option>
          <option value="cashfree">Cashfree</option>
        </select>

        <select
          className="select"
          value={filters.payment_type}
          onChange={(e) => setFilter('payment_type', e.target.value)}
        >
          <option value="">Any type</option>
          <option value="one_time">One-time</option>
          <option value="subscription">Subscription</option>
        </select>

        <input
          className="input"
          placeholder="Search name or email…"
          value={filters.q}
          onChange={(e) => setFilter('q', e.target.value)}
        />

        <div className="spacer" />
        <span className="hint">{total} total</span>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transactions found"
            hint="Transactions appear here once a customer starts a checkout."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Gateway</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {formatDate(tx.created_at)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 550 }}>{tx.customer_name || '—'}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>
                        {tx.customer_email || ''}
                      </div>
                    </td>
                    <td>{tx.product_name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{clientName(tx.client_id)}</td>
                    <td className="num">{formatAmount(tx.amount_paise, tx.currency)}</td>
                    <td>
                      <TypeBadge paymentType={tx.payment_type} />
                    </td>
                    <td>
                      <GatewayBadge gateway={tx.gateway} />
                    </td>
                    <td>
                      <StatusBadge status={tx.status} />
                      {tx.error_message && (
                        <div
                          className="truncate"
                          style={{ color: 'var(--red)', fontSize: 12, maxWidth: 200 }}
                          title={tx.error_message}
                        >
                          {tx.error_message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="card-head" style={{ borderBottom: 'none', borderTop: '1px solid var(--border)' }}>
            <span className="hint">
              Page {page} of {pageCount}
            </span>
            <div className="row">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
              >
                Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
