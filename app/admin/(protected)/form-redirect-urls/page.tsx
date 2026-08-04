'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminFetch, Spinner, EmptyState } from '../../components/ui';

interface Client {
  id: string;
  name: string;
}

interface FunnelRoute {
  id: number;
  hostname: string;
  path_prefix: string;
  client_id: string;
  price_id: string;
  is_active: boolean;
}

interface Price {
  id: string;
  product_name: string;
}

/**
 * GoHighLevel substitutes {{contact.*}} tokens when it redirects, which is how
 * customer details reach the checkout page for the snippet to read.
 */
const GHL_QUERY =
  '?name={{contact.first_name}} {{contact.last_name}}' +
  '&email={{contact.email}}' +
  '&phone={{contact.phone}}';

export default function FormRedirectUrlsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<FunnelRoute[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch<{ clients: Client[] }>('/api/admin/clients'),
      adminFetch<{ routes: FunnelRoute[] }>('/api/admin/funnel-routes'),
      adminFetch<{ prices: Price[] }>('/api/admin/prices'),
    ])
      .then(([c, r, p]) => {
        setClients(c.clients);
        setRoutes(r.routes.filter((route) => route.is_active));
        setPrices(p.prices);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, FunnelRoute[]>();
    for (const client of clients) map.set(client.id, []);
    for (const route of routes) {
      if (!map.has(route.client_id)) map.set(route.client_id, []);
      map.get(route.client_id)!.push(route);
    }
    return map;
  }, [clients, routes]);

  const productOf = (priceId: string) =>
    prices.find((p) => p.id === priceId)?.product_name ?? '—';

  function urlFor(route: FunnelRoute) {
    return `https://${route.hostname}${route.path_prefix}${GHL_QUERY}`;
  }

  function copy(route: FunnelRoute) {
    navigator.clipboard.writeText(urlFor(route));
    setCopied(route.id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <Spinner />;

  const clientsWithRoutes = clients.filter((c) => (grouped.get(c.id) ?? []).length > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Form redirect URLs</h1>
          <p className="page-subtitle">
            Set these as the redirect URL on the GoHighLevel form that feeds each checkout page.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="alert alert-info">
        The checkout snippet reads the customer&apos;s name, email and phone from these query
        parameters. If they&apos;re missing, checkout cannot start.
      </div>

      {clientsWithRoutes.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No active routes"
            hint="Add and activate a funnel route to see its redirect URL here."
          />
        </div>
      ) : (
        <div className="stack">
          {clientsWithRoutes.map((client) => (
            <div className="card" key={client.id}>
              <div className="card-head">
                <div>
                  <div className="card-title">{client.name}</div>
                  <div className="group-id">{client.id}</div>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Redirect URL</th>
                      <th style={{ textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(grouped.get(client.id) ?? []).map((route) => (
                      <tr key={route.id}>
                        <td style={{ fontWeight: 550, whiteSpace: 'nowrap' }}>
                          {productOf(route.price_id)}
                        </td>
                        <td>
                          <code
                            className="mono truncate"
                            style={{ maxWidth: 560, color: 'var(--text-muted)' }}
                            title={urlFor(route)}
                          >
                            {urlFor(route)}
                          </code>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => copy(route)}>
                            {copied === route.id ? 'Copied' : 'Copy'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
