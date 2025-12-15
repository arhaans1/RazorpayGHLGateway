'use client';

import { useState } from 'react';

const checkoutSnippet = `<!--
  Universal Razorpay Checkout Snippet
  Paste this into your GoHighLevel or Landing Page checkout page
  
  IMPORTANT: Replace YOUR_VERCEL_URL with your actual Vercel deployment URL
  Example: https://your-app.vercel.app
  
  CUSTOMER DATA SOURCES (checked in order):
  1. Manual override: Set window.razorpayCheckoutConfig = { name: '...', email: '...', phone: '...' } before this script
  2. URL parameters: ?name=John&email=john@example.com&phone=1234567890
  3. Form fields: Inputs with name/id "name", "email", "phone", "contact", etc.
  4. JavaScript variables: window.name, window.email, window.phone, window.customer, etc.
  5. localStorage/sessionStorage: customerName, customerEmail, customerPhone
  
  If data is not found, the script will show a detailed error message with debugging info.
-->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  (async () => {
    try {
      // Wait for page to be fully loaded
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            document.addEventListener('DOMContentLoaded', resolve);
            // Also wait a bit for dynamic content
            setTimeout(resolve, 500);
          }
        });
      }
      
      // Configuration: Replace with your Vercel deployment URL
      const API_BASE_URL = 'https://razorpay-ghl-gateway.vercel.app'; // e.g., 'https://your-app.vercel.app'
      
      // Helper function to safely get value from multiple sources
      function getValue(sources) {
        for (const source of sources) {
          try {
            if (source && typeof source === 'string' && source.trim()) {
              return source.trim();
            }
          } catch (e) {
            // Skip this source if it causes an error
            continue;
          }
        }
        return '';
      }
      
      // Helper to safely access localStorage
      function safeGetStorage(key, storage) {
        try {
          return storage.getItem(key);
        } catch (e) {
          return null;
        }
      }
    
      // Try to get name from multiple sources
      // Priority: Manual override > URL params > Form fields > JS variables > localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const name = getValue([
        window.razorpayCheckoutConfig?.name, // Manual override
        urlParams.get('name'),
        urlParams.get('fname'),
        urlParams.get('first_name'),
        document.querySelector('input[name="name"]')?.value,
        document.querySelector('input[name="fname"]')?.value,
        document.querySelector('input[name="first_name"]')?.value,
        document.querySelector('input[name="firstName"]')?.value,
        document.querySelector('#name')?.value,
        document.querySelector('#fname')?.value,
        document.querySelector('[data-name]')?.getAttribute('data-name'),
        document.querySelector('[data-field="name"]')?.value,
        window.customerName,
        window.firstName,
        window.customer?.name,
        window.customer?.firstName,
        safeGetStorage('customerName', localStorage),
        safeGetStorage('customerName', sessionStorage)
      ]);
      
      // Try to get email from multiple sources
      const email = getValue([
        window.razorpayCheckoutConfig?.email, // Manual override
        urlParams.get('email'),
        urlParams.get('e-mail'),
        document.querySelector('input[name="email"]')?.value,
        document.querySelector('input[name="e-mail"]')?.value,
        document.querySelector('input[type="email"]')?.value,
        document.querySelector('#email')?.value,
        document.querySelector('[data-email]')?.getAttribute('data-email'),
        document.querySelector('[data-field="email"]')?.value,
        window.email,
        window.customerEmail,
        window.userEmail,
        window.customer?.email,
        safeGetStorage('customerEmail', localStorage),
        safeGetStorage('customerEmail', sessionStorage)
      ]);
      
      // Try to get phone from multiple sources
      const phone = getValue([
        window.razorpayCheckoutConfig?.phone || window.razorpayCheckoutConfig?.contact, // Manual override
        urlParams.get('phone'),
        urlParams.get('contact'),
        urlParams.get('mobile'),
        urlParams.get('tel'),
        urlParams.get('phoneNumber'),
        document.querySelector('input[name="phone"]')?.value,
        document.querySelector('input[name="contact"]')?.value,
        document.querySelector('input[name="mobile"]')?.value,
        document.querySelector('input[name="tel"]')?.value,
        document.querySelector('input[name="phoneNumber"]')?.value,
        document.querySelector('input[type="tel"]')?.value,
        document.querySelector('#phone')?.value,
        document.querySelector('#contact')?.value,
        document.querySelector('#mobile')?.value,
        document.querySelector('[data-phone]')?.getAttribute('data-phone'),
        document.querySelector('[data-contact]')?.getAttribute('data-contact'),
        document.querySelector('[data-field="phone"]')?.value,
        window.phone,
        window.contact,
        window.mobile,
        window.customerPhone,
        window.customer?.phone,
        window.customer?.contact,
        safeGetStorage('customerPhone', localStorage),
        safeGetStorage('customerPhone', sessionStorage)
      ]);
    
      // Get current page URL
      const page_url = window.location.href;
      
      // Debug: Log what we found
      console.log('Extracted values:', { name, email, phone, page_url });
      
      try {
        // Validate required fields
        const missingFields = [];
        if (!name) missingFields.push('name');
        if (!email) missingFields.push('email');
        if (!phone) missingFields.push('phone/contact');
        
        if (missingFields.length > 0) {
          const errorMsg = \`Missing required information: \${missingFields.join(', ')}\\n\\n\` +
            \`The script tried to find these values from:\\n\` +
            \`- URL parameters (e.g., ?name=John&email=john@example.com&phone=1234567890)\\n\` +
            \`- Form fields with common names (name, email, phone, contact, etc.)\\n\` +
            \`- JavaScript variables (window.name, window.email, window.phone)\\n\\n\` +
            \`Please ensure the customer information is available in one of these formats.\\n\\n\` +
            \`Current URL: \${page_url}\\n\` +
            \`Found values: name="\${name}", email="\${email}", phone="\${phone}"\`;
          
          console.error('Missing fields:', missingFields);
          console.error('Available form fields:', Array.from(document.querySelectorAll('input')).map(input => ({
            name: input.name,
            id: input.id,
            type: input.type,
            value: input.value ? '***' : '(empty)'
          })));
          
          alert(errorMsg);
          return;
        }
        
        console.log('Creating order with:', { page_url, name, email, contact: phone });
        console.log('API URL:', \`\${API_BASE_URL}/api/create-order\`);
        
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
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'unknown_error', detail: \`HTTP \${response.status}: \${response.statusText}\` }));
          console.error('API Error Response:', errorData);
          throw new Error(JSON.stringify(errorData));
        }
        
        const data = await response.json();
        console.log('API Response:', data);
        
        // Check for errors
        if (!data.order_id) {
          console.error('Order creation failed - Response data:', data);
          
          // Show detailed error message
          let errorMessage = 'Order creation failed.\\n\\n';
          if (data.error) {
            errorMessage += 'Error Type: ' + data.error + '\\n';
          }
          if (data.detail) {
            if (typeof data.detail === 'string') {
              errorMessage += '\\nDetails: ' + data.detail;
            } else {
              errorMessage += '\\nDetails: ' + JSON.stringify(data.detail, null, 2);
            }
          }
          if (data.razorpay_response) {
            errorMessage += '\\n\\nRazorpay Response: ' + JSON.stringify(data.razorpay_response, null, 2);
          }
          errorMessage += '\\n\\nPlease check the browser console (F12) for more details.';
          
          alert(errorMessage);
          return;
        }
        
        // Verify Razorpay is loaded
        if (typeof Razorpay === 'undefined') {
          console.error('Razorpay script not loaded');
          alert('Payment gateway script failed to load. Please refresh the page and try again.');
          return;
        }
        
        // Verify we have all required data
        if (!data.key_id || !data.order_id) {
          console.error('Missing required Razorpay data:', data);
          alert('Invalid response from server. Missing payment gateway credentials.');
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
            console.log('Payment successful:', response);
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
        
        console.log('Opening Razorpay checkout with options:', { ...options, key: '***' });
        
        // Small delay to avoid blank page issues, then open Razorpay checkout
        setTimeout(() => {
          try {
            const razorpay = new Razorpay(options);
            razorpay.open();
          } catch (error) {
            console.error('Error opening Razorpay:', error);
            alert('Failed to open payment gateway. Error: ' + error.message);
          }
        }, 700);
        
      } catch (error) {
        console.error('Error:', error);
        let errorMessage = 'An error occurred. ';
        try {
          const errorData = JSON.parse(error.message);
          if (errorData.error) {
            errorMessage += '\\n\\nError: ' + errorData.error;
          }
          if (errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage += '\\n\\nDetails: ' + errorData.detail;
            } else {
              errorMessage += '\\n\\nDetails: ' + JSON.stringify(errorData.detail, null, 2);
            }
          }
        } catch (e) {
          errorMessage += '\\n\\n' + error.message;
        }
        errorMessage += '\\n\\nPlease check the browser console (F12) for more details.';
        alert(errorMessage);
      }
    } catch (outerError) {
      // Catch any errors that occur during script initialization
      console.error('Fatal error in checkout script:', outerError);
      // Don't show alert for initialization errors to avoid breaking the page
      // Just log to console
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

