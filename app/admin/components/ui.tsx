'use client';

import { ReactNode, useEffect } from 'react';

/* -------------------------------------------------------------- formatting */

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  // Latin "AED" rather than د.إ — clearer than Arabic script in an admin table.
  AED: 'AED ',
};

/**
 * Amounts are stored in the smallest unit. That is paise for INR and fils for
 * AED, but every currency we support divides by 100 the same way.
 */
export function formatAmount(minorUnits: number, currency = 'INR'): string {
  const code = currency?.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? `${currency} `;
  const major = (minorUnits ?? 0) / 100;

  // Indian digit grouping (1,00,000) is correct for INR and wrong for anything
  // else, where 100,000 is expected.
  const locale = code === 'INR' ? 'en-IN' : 'en-US';

  return `${symbol}${major.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function describeBilling(price: {
  payment_type?: string | null;
  billing_period?: string | null;
  billing_interval?: number | null;
  total_count?: number | null;
}): string {
  if (price.payment_type !== 'subscription') return 'One-time';

  const interval = price.billing_interval || 1;
  const period = price.billing_period || 'monthly';
  const unit = period.replace(/ly$/, '');
  const every = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

  return price.total_count ? `${every} × ${price.total_count}` : every;
}

/* ------------------------------------------------------------------ badges */

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    paid: 'badge-green',
    active: 'badge-green',
    completed: 'badge-green',
    created: 'badge-gray',
    authenticated: 'badge-blue',
    pending: 'badge-amber',
    halted: 'badge-amber',
    failed: 'badge-red',
    cancelled: 'badge-red',
    expired: 'badge-red',
    refunded: 'badge-amber',
  };

  return <span className={`badge ${tone[status] ?? 'badge-gray'}`}>{status}</span>;
}

export function GatewayBadge({ gateway }: { gateway: string }) {
  return <span className="badge badge-gray">{gateway === 'cashfree' ? 'Cashfree' : 'Razorpay'}</span>;
}

export function TypeBadge({ paymentType }: { paymentType?: string | null }) {
  return paymentType === 'subscription' ? (
    <span className="badge badge-blue">Subscription</span>
  ) : (
    <span className="badge badge-gray">One-time</span>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Escape-to-close, and prevent the page behind from scrolling.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ empty/loader */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

/* --------------------------------------------------------------- api fetch */

/**
 * Thin wrapper over fetch for the /api/admin/* routes: always JSON, and turns a
 * non-2xx into a thrown Error carrying the server's message so callers can
 * surface it directly.
 */
export async function adminFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}
