'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '../../components/ui';

/**
 * The snippet is served from /checkout-snippet.html rather than duplicated here
 * as a string literal. Previously the same ~500 lines existed in both places and
 * drifted apart whenever only one was patched.
 */
const SNIPPET_URL = '/checkout-snippet.html';

export default function CheckoutCodePage() {
  const [snippet, setSnippet] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(SNIPPET_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the snippet (${r.status})`);
        return r.text();
      })
      .then(setSnippet)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // clipboard API needs a secure context; fall back to a temp textarea.
      const el = document.createElement('textarea');
      el.value = snippet;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Checkout code</h1>
          <p className="page-subtitle">
            Paste this into the checkout page of any funnel you&apos;ve configured a route for.
          </p>
        </div>
        <button className="btn btn-primary" onClick={copy} disabled={!snippet}>
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stack">
        <div className="card">
          <div className="card-head">
            <div className="card-title">How to use it</div>
          </div>
          <div className="card-pad">
            <ol style={{ paddingLeft: 18, lineHeight: 1.9 }}>
              <li>Add the client, product and funnel route in this admin panel first.</li>
              <li>
                Open the checkout page in GoHighLevel and add a <strong>Custom Code</strong> block.
              </li>
              <li>Paste the snippet below and publish the page.</li>
              <li>
                Make sure the form sends <code className="mono">name</code>,{' '}
                <code className="mono">email</code> and <code className="mono">phone</code> as URL
                parameters to that page.
              </li>
            </ol>
            <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
              The same snippet handles Razorpay and Cashfree, and one-time and subscription
              products. Which one runs is decided by the funnel route, so you never need a
              different snippet per page.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Snippet</div>
            <button className="btn btn-secondary btn-sm" onClick={copy} disabled={!snippet}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <pre
              style={{
                margin: 0,
                padding: 18,
                background: 'var(--surface-alt)',
                borderRadius: '0 0 10px 10px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: 'auto',
                maxHeight: 460,
                overflowY: 'auto',
                color: 'var(--text)',
              }}
            >
              <code>{snippet}</code>
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
