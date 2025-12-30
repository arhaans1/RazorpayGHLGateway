'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Client {
  id: string;
  name: string;
  razorpay_key_id: string;
  razorpay_key_secret: string;
  cashfree_app_id?: string;
  cashfree_secret_key?: string;
  cashfree_env?: 'sandbox' | 'production';
  created_at: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    cashfree_app_id: '',
    cashfree_secret_key: '',
    cashfree_env: 'production' as 'sandbox' | 'production',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      alert('Error loading clients: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
        .update({
          name: formData.name,
          razorpay_key_id: formData.razorpay_key_id,
          razorpay_key_secret: formData.razorpay_key_secret,
          cashfree_app_id: formData.cashfree_app_id || null,
          cashfree_secret_key: formData.cashfree_secret_key || null,
          cashfree_env: formData.cashfree_env,
        })
          .eq('id', editingClient.id);

        if (error) throw error;
      } else {
        // Create new client
        const { error } = await supabase.from('clients').insert([formData]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingClient(null);
      setFormData({ id: '', name: '', razorpay_key_id: '', razorpay_key_secret: '' });
      fetchClients();
    } catch (error: any) {
      console.error('Error saving client:', error);
      alert('Error saving client: ' + error.message);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      id: client.id,
      name: client.name,
      razorpay_key_id: client.razorpay_key_id,
      razorpay_key_secret: client.razorpay_key_secret,
      cashfree_app_id: client.cashfree_app_id || '',
      cashfree_secret_key: client.cashfree_secret_key || '',
      cashfree_env: client.cashfree_env || 'production',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;

    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert('Error deleting client: ' + error.message);
    }
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Clients</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingClient(null);
            setFormData({ 
              id: '', 
              name: '', 
              razorpay_key_id: '', 
              razorpay_key_secret: '',
              cashfree_app_id: '',
              cashfree_secret_key: '',
              cashfree_env: 'production',
            });
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
          {showForm ? 'Cancel' : 'Add Client'}
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
          <h2>{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              ID (unique identifier)
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              required
              disabled={!!editingClient}
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
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
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
              Razorpay Key ID
            </label>
            <input
              type="text"
              value={formData.razorpay_key_id}
              onChange={(e) => setFormData({ ...formData, razorpay_key_id: e.target.value })}
              required
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
              Razorpay Key Secret
            </label>
            <input
              type="password"
              value={formData.razorpay_key_secret}
              onChange={(e) => setFormData({ ...formData, razorpay_key_secret: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div style={{ marginTop: '30px', marginBottom: '15px', paddingTop: '20px', borderTop: '2px solid #ddd' }}>
            <h3 style={{ marginBottom: '15px' }}>Cashfree (Optional)</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Optional: Add Cashfree credentials if you want to use Cashfree payment gateway for some routes.
            </p>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Cashfree App ID
            </label>
            <input
              type="text"
              value={formData.cashfree_app_id}
              onChange={(e) => setFormData({ ...formData, cashfree_app_id: e.target.value })}
              placeholder="Optional - Leave empty if not using Cashfree"
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
              Cashfree Secret Key
            </label>
            <input
              type="password"
              value={formData.cashfree_secret_key}
              onChange={(e) => setFormData({ ...formData, cashfree_secret_key: e.target.value })}
              placeholder="Optional - Leave empty if not using Cashfree"
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
              Cashfree Environment
            </label>
            <select
              value={formData.cashfree_env}
              onChange={(e) => setFormData({ ...formData, cashfree_env: e.target.value as 'sandbox' | 'production' })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="production">Production</option>
              <option value="sandbox">Sandbox (Testing)</option>
            </select>
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
            {editingClient ? 'Update Client' : 'Create Client'}
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
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Key ID (masked)</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Created</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{client.id}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{client.name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  {maskKey(client.razorpay_key_id)}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  {new Date(client.created_at).toLocaleDateString()}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  <button
                    onClick={() => handleEdit(client)}
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
                    onClick={() => handleDelete(client.id)}
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
        {clients.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No clients found. Add your first client above.
          </div>
        )}
      </div>
    </div>
  );
}

