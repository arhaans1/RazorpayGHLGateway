'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Price {
  id: string;
  client_id: string;
  product_name: string;
  amount_paise: number;
  currency: string;
  thank_you_url: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

export default function PricesPage() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrice, setEditingPrice] = useState<Price | null>(null);
  const [filterClientId, setFilterClientId] = useState<string>('');
  const [formData, setFormData] = useState({
    id: '',
    client_id: '',
    product_name: '',
    amount_paise: '',
    currency: 'INR',
    thank_you_url: '',
  });

  useEffect(() => {
    fetchClients();
    fetchPrices();
  }, []);

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
      let query = supabase.from('prices').select('*').order('created_at', { ascending: false });

      if (filterClientId) {
        query = query.eq('client_id', filterClientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPrices(data || []);
    } catch (error: any) {
      console.error('Error fetching prices:', error);
      alert('Error loading prices: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, [filterClientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const priceData = {
        ...formData,
        amount_paise: parseInt(formData.amount_paise),
      };

      if (editingPrice) {
        const { error } = await supabase
          .from('prices')
          .update(priceData)
          .eq('id', editingPrice.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('prices').insert([priceData]);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingPrice(null);
      setFormData({
        id: '',
        client_id: '',
        product_name: '',
        amount_paise: '',
        currency: 'INR',
        thank_you_url: '',
      });
      fetchPrices();
    } catch (error: any) {
      console.error('Error saving price:', error);
      alert('Error saving price: ' + error.message);
    }
  };

  const handleEdit = (price: Price) => {
    setEditingPrice(price);
    setFormData({
      id: price.id,
      client_id: price.client_id,
      product_name: price.product_name,
      amount_paise: price.amount_paise.toString(),
      currency: price.currency,
      thank_you_url: price.thank_you_url,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price?')) return;

    try {
      const { error } = await supabase.from('prices').delete().eq('id', id);
      if (error) throw error;
      fetchPrices();
    } catch (error: any) {
      console.error('Error deleting price:', error);
      alert('Error deleting price: ' + error.message);
    }
  };

  const formatAmount = (paise: number) => {
    return `₹${(paise / 100).toFixed(2)}`;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Prices</h1>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingPrice(null);
            setFormData({
              id: '',
              client_id: '',
              product_name: '',
              amount_paise: '',
              currency: 'INR',
              thank_you_url: '',
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
          {showForm ? 'Cancel' : 'Add Price'}
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Filter by Client:</label>
        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minWidth: '200px',
          }}
        >
          <option value="">All Clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
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
          <h2>{editingPrice ? 'Edit Price' : 'Add New Price'}</h2>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              ID (unique identifier)
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              required
              disabled={!!editingPrice}
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
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
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
              Product Name
            </label>
            <input
              type="text"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
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
              Amount (in paise, e.g., 199900 for ₹1,999)
            </label>
            <input
              type="number"
              value={formData.amount_paise}
              onChange={(e) => setFormData({ ...formData, amount_paise: e.target.value })}
              required
              min="1"
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
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Thank You URL (full URL to redirect after payment)
            </label>
            <input
              type="url"
              value={formData.thank_you_url}
              onChange={(e) => setFormData({ ...formData, thank_you_url: e.target.value })}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
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
            {editingPrice ? 'Update Price' : 'Create Price'}
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
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Client</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Product</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Amount</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Currency</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Thank You URL</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((price) => (
              <tr key={price.id}>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{price.id}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{price.client_id}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{price.product_name}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  {formatAmount(price.amount_paise)}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>{price.currency}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {price.thank_you_url}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                  <button
                    onClick={() => handleEdit(price)}
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
                    onClick={() => handleDelete(price.id)}
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
        {prices.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No prices found. Add your first price above.
          </div>
        )}
      </div>
    </div>
  );
}

