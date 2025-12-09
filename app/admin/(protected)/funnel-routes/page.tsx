'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface FunnelRoute {
  id: number;
  hostname: string;
  path_prefix: string;
  client_id: string;
  price_id: string;
  is_active: boolean;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface Price {
  id: string;
  product_name: string;
  client_id: string;
}

export default function FunnelRoutesPage() {
  const [routes, setRoutes] = useState<FunnelRoute[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [filteredPrices, setFilteredPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<FunnelRoute | null>(null);
  const [formData, setFormData] = useState({
    hostname: '',
    path_prefix: '',
    client_id: '',
    price_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchClients();
    fetchPrices();
    fetchRoutes();
  }, []);

  useEffect(() => {
    // Filter prices when client changes
    if (formData.client_id) {
      setFilteredPrices(prices.filter((p) => p.client_id === formData.client_id));
    } else {
      setFilteredPrices([]);
    }
  }, [formData.client_id, prices]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('prices')
        .select('id, product_name, client_id')
        .order('product_name');

      if (error) throw error;
      setPrices(data || []);
    } catch (error: any) {
      console.error('Error fetching prices:', error);
    }
  };

  const fetchRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from('funnel_routes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoutes(data || []);
    } catch (error: any) {
      console.error('Error fetching routes:', error);
      alert('Error loading routes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRoute) {
        const { error } = await supabase
          .from('funnel_routes')
          .update(formData)
          .eq('id', editingRoute.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('funnel_routes').insert([formData]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingRoute(null);
      setFormData({
        hostname: '',
        path_prefix: '',
        client_id: '',
        price_id: '',
        is_active: true,
      });
      setFilteredPrices([]);
      fetchRoutes();
    } catch (error: any) {
      console.error('Error saving route:', error);
      alert('Error saving route: ' + error.message);
    }
  };

  const handleEdit = (route: FunnelRoute) => {
    setEditingRoute(route);
    setFormData({
      hostname: route.hostname,
      path_prefix: route.path_prefix,
      client_id: route.client_id,
      price_id: route.price_id,
      is_active: route.is_active,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (route: FunnelRoute) => {
    try {
      const { error } = await supabase
        .from('funnel_routes')
        .update({ is_active: !route.is_active })
        .eq('id', route.id);

      if (error) throw error;
      fetchRoutes();
    } catch (error: any) {
      console.error('Error toggling route:', error);
      alert('Error updating route: ' + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
      const { error } = await supabase.from('funnel_routes').delete().eq('id', id);
      if (error) throw error;
      fetchRoutes();
    } catch (error: any) {
      console.error('Error deleting route:', error);
      alert('Error deleting route: ' + error.message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Funnel Routes</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingRoute(null);
            setFormData({
              hostname: '',
              path_prefix: '',
              client_id: '',
              price_id: '',
              is_active: true,
            });
            setFilteredPrices([]);
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : 'Add Route'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <h2>{editingRoute ? 'Edit Route' : 'Add New Route'}</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Hostname (e.g., launchwithai.in)
            </label>
            <input
              type="text"
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              required
              placeholder="launchwithai.in"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Path Prefix (e.g., /checkout or /bootcamp/checkout)
            </label>
            <input
              type="text"
              value={formData.path_prefix}
              onChange={(e) => setFormData({ ...formData, path_prefix: e.target.value })}
              required
              placeholder="/checkout"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Client
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value, price_id: '' })}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Price
            </label>
            <select
              value={formData.price_id}
              onChange={(e) => setFormData({ ...formData, price_id: e.target.value })}
              required
              disabled={!formData.client_id || filteredPrices.length === 0}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="">
                {!formData.client_id
                  ? 'Select a client first'
                  : filteredPrices.length === 0
                  ? 'No prices for this client'
                  : 'Select a price'}
              </option>
              {filteredPrices.map((price) => (
                <option key={price.id} value={price.id}>
                  {price.product_name} ({price.id})
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span style={{ fontWeight: 'bold' }}>Active</span>
            </label>
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {editingRoute ? 'Update Route' : 'Create Route'}
          </button>
        </form>
      )}

      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Hostname</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Path</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Client</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Price</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Created</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{route.hostname}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{route.path_prefix}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{route.client_id}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{route.price_id}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: route.is_active ? '#d4edda' : '#f8d7da',
                      color: route.is_active ? '#155724' : '#721c24',
                    }}
                  >
                    {route.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  {new Date(route.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  <button
                    onClick={() => handleEdit(route)}
                    style={{
                      marginRight: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(route)}
                    style={{
                      marginRight: '10px',
                      padding: '5px 10px',
                      backgroundColor: route.is_active ? '#ffc107' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {route.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(route.id)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {routes.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No routes found. Add your first route above.
          </div>
        )}
      </div>
    </div>
  );
}

