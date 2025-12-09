'use client';

import { useState } from 'react';

const checkoutSnippet = `<!--
  Universal Razorpay Checkout Snippet
  Paste this into your GoHighLevel or Landing Page checkout page
  
  IMPORTANT: Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
  Example: https://your-app.vercel.app
-->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  (async () => {
    // Configuration: Replace with your Vercel deployment URL
    const API_BASE_URL = 'https://razorpay-ghl-gateway.vercel.app'; // e.g., 'https://your-app.vercel.app'
    
    // Read parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name') || '';
    const email = urlParams.get('email') || '';
    const phone = urlParams.get('phone') || urlParams.get('contact') || '';
    
    // Get current page URL
    const page_url = window.location.href;
    
    try {
      // Call backend API to create Razorpay order
      const response = await fetch(\`\${API_BASE_URL}/api/create-order\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_url: page_url,
          name: name,
          email: email,
          contact: phone,
        }),
      });
      
      const data = await response.json();
      
      // Check for errors
      if (!data.order_id) {
        console.error('Order creation failed:', data);
        alert('Order creation failed. Please try again or contact support.');
        return;
      }
      
      // Configure Razorpay Checkout
      const options = {
        key: data.key_id,
        order_id: data.order_id,
        name: data.product_name,
        description: data.product_name,
        prefill: data.prefill,
        handler: function (response) {
          // Redirect to thank you page on successful payment
          window.location.href = data.thank_you_url;
        },
        modal: {
          ondismiss: function() {
            // Optional: handle modal close
            console.log('Payment modal closed');
          }
        }
      };
      
      // Small delay to avoid blank page issues, then open Razorpay checkout
      setTimeout(() => {
        const razorpay = new Razorpay(options);
        razorpay.open();
      }, 700);
      
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again or contact support.');
    }
  })();
</script>`;

export default function CheckoutCodePage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkoutSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = checkoutSnippet;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Checkout Code</h1>
        <button
          onClick={handleCopy}
          style={{
            padding: '10px 20px',
            backgroundColor: copied ? '#28a745' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ marginBottom: '15px' }}>
          <h2 style={{ marginBottom: '10px' }}>Universal Razorpay Checkout Snippet</h2>
          <p style={{ color: '#666', marginBottom: '10px' }}>
            Copy this code and paste it into your GoHighLevel or Landing Page checkout page.
          </p>
          <p style={{ color: '#666', fontSize: '14px' }}>
            <strong>Note:</strong> The code is already configured with your Vercel URL. Just copy and paste!
          </p>
        </div>

        <div
          style={{
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '15px',
            position: 'relative',
          }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <code>{checkoutSnippet}</code>
          </pre>
        </div>

        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px' }}>How to Use:</h3>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Click the "Copy Code" button above</li>
            <li style={{ marginBottom: '8px' }}>Go to your GoHighLevel or Landing Page checkout page</li>
            <li style={{ marginBottom: '8px' }}>Add a "Custom Code" or "HTML" block</li>
            <li style={{ marginBottom: '8px' }}>Paste the copied code</li>
            <li style={{ marginBottom: '8px' }}>Save and publish your page</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

