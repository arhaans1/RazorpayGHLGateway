'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Client {
  id: string;
  name: string;
}

interface FunnelRoute {
  id: number;
  hostname: string;
  path_prefix: string;
  client_id: string;
  is_active: boolean;
}

interface ClientWithRoutes {
  client: Client;
  routes: FunnelRoute[];
}

export default function FormRedirectUrlsPage() {
  const [clientsWithRoutes, setClientsWithRoutes] = useState<ClientWithRoutes[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (clientsError) throw clientsError;

      // Fetch all active funnel routes
      const { data: routes, error: routesError } = await supabase
        .from('funnel_routes')
        .select('id, hostname, path_prefix, client_id, is_active')
        .eq('is_active', true)
        .order('hostname');

      if (routesError) throw routesError;

      // Group routes by client
      const clientsWithRoutesData: ClientWithRoutes[] = (clients || []).map((client) => ({
        client,
        routes: (routes || []).filter((route) => route.client_id === client.id),
      }));

      setClientsWithRoutes(clientsWithRoutesData);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRedirectUrl = (route: FunnelRoute) => {
    const baseUrl = `https://${route.hostname}${route.path_prefix}`;
    // GHL shortcode for full name (recommended)
    const urlParams = `?name={{contact.name}}&email={{contact.email}}&phone={{contact.phone}}`;
    return baseUrl + urlParams;
  };

  const generateRedirectUrlAlt = (route: FunnelRoute) => {
    const baseUrl = `https://${route.hostname}${route.path_prefix}`;
    // Alternative: if GHL has separate first_name and last_name fields
    const urlParams = `?name={{contact.first_name}} {{contact.last_name}}&email={{contact.email}}&phone={{contact.phone}}`;
    return baseUrl + urlParams;
  };

  const handleCopy = async (text: string, clientId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedClientId(clientId);
      setTimeout(() => setCopiedClientId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedClientId(clientId);
      setTimeout(() => setCopiedClientId(null), 2000);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1>Form Redirect URLs</h1>
        <p style={{ color: '#666', marginTop: '10px' }}>
          Copy these URLs to use in your GoHighLevel opt-in form redirect settings. These URLs include GHL shortcodes that will automatically populate customer data.
        </p>
      </div>

      {clientsWithRoutes.length === 0 ? (
        <div style={{ padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
          <p>No clients with active funnel routes found. Please create clients and funnel routes first.</p>
        </div>
      ) : (
        clientsWithRoutes.map(({ client, routes }) => {
          if (routes.length === 0) {
            return (
              <div
                key={client.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                <h2 style={{ marginTop: 0, marginBottom: '10px' }}>{client.name}</h2>
                <p style={{ color: '#666' }}>No active funnel routes configured for this client.</p>
              </div>
            );
          }

          return (
            <div
              key={client.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: '15px' }}>{client.name}</h2>

              {routes.map((route) => (
                <div
                  key={route.id}
                  style={{
                    marginBottom: '20px',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6',
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Route:</strong> {route.hostname}
                    {route.path_prefix}
                  </div>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Recommended URL (Full Name):
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <code
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {generateRedirectUrl(route)}
                      </code>
                      <button
                        onClick={() => handleCopy(generateRedirectUrl(route), client.id)}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: copiedClientId === client.id ? '#28a745' : '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {copiedClientId === client.id ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Alternative URL (First Name + Last Name):
                    </label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <code
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#fff',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '13px',
                          wordBreak: 'break-all',
                        }}
                      >
                        {generateRedirectUrlAlt(route)}
                      </code>
                      <button
                        onClick={() => handleCopy(generateRedirectUrlAlt(route), client.id + '_alt')}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: copiedClientId === client.id + '_alt' ? '#28a745' : '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {copiedClientId === client.id + '_alt' ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '5px', marginBottom: 0 }}>
                      Use this if your GHL form has separate first_name and last_name fields instead of a single name field
                    </p>
                  </div>

                  <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
                    <strong style={{ display: 'block', marginBottom: '5px' }}>GHL Shortcodes Used:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '13px' }}>
                      <li>
                        <code>{'{{contact.first_name}}'}</code> - Customer's first name
                      </li>
                      <li>
                        <code>{'{{contact.last_name}}'}</code> - Customer's last name
                      </li>
                      <li>
                        <code>{'{{contact.name}}'}</code> - Customer's full name (alternative)
                      </li>
                      <li>
                        <code>{'{{contact.email}}'}</code> - Customer's email address
                      </li>
                      <li>
                        <code>{'{{contact.phone}}'}</code> - Customer's phone number
                      </li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: 0 }}>How to Use:</h3>
        <ol style={{ margin: '10px 0', paddingLeft: '20px' }}>
          <li style={{ marginBottom: '8px' }}>Copy the redirect URL for your client above</li>
          <li style={{ marginBottom: '8px' }}>Go to your GoHighLevel opt-in form settings</li>
          <li style={{ marginBottom: '8px' }}>Find the "Redirect URL" or "Thank You Page" setting</li>
          <li style={{ marginBottom: '8px' }}>Paste the copied URL</li>
          <li style={{ marginBottom: '8px' }}>Save the form</li>
          <li style={{ marginBottom: '8px' }}>
            When users submit the form, they'll be redirected to the checkout page with their information automatically passed via URL parameters
          </li>
        </ol>
        <p style={{ marginTop: '15px', marginBottom: 0, fontSize: '14px' }}>
          <strong>Note:</strong> The GHL shortcodes (like <code>{'{{contact.email}}'}</code>) will be automatically replaced with the actual customer data when the form is submitted.
        </p>
      </div>
    </div>
  );
}

