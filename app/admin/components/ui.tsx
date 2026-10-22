'use client';

import { ReactNode, useEffect } from 'react';
import {
  DayRange,
  PRESETS,
  presetRange,
  matchPreset,
  todayIST,
} from '@/lib/date-range';

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
    // Same zone the date-range filter uses, so a row that matches "22 Oct"
    // never displays as 21 Oct on a laptop set to another timezone.
    timeZone: 'Asia/Kolkata',
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

/* ------------------------------------------------------- multi-currency */

/**
 * Revenue is totalled per currency (INR paise and AED fils can't be added),
 * so render each currency separately, INR first. Empty means nothing paid.
 */
export function formatRevenue(revenue?: Record<string, number> | null): string {
  const entries = Object.entries(revenue ?? {}).filter(([, v]) => v > 0);
  if (!entries.length) return formatAmount(0, 'INR');
  entries.sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
  return entries.map(([cur, v]) => formatAmount(v, cur)).join(' + ');
}

/** Sort key for revenue: INR value, then everything else as a tiebreaker. */
export function revenueSortKey(revenue?: Record<string, number> | null): number {
  const r = revenue ?? {};
  const inr = r.INR ?? 0;
  const other = Object.entries(r).reduce((s, [k, v]) => (k === 'INR' ? s : s + v), 0);
  return inr * 1e6 + other;
}

/* ------------------------------------------------------- date range */

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DayRange;
  onChange: (next: DayRange) => void;
}) {
  const active = matchPreset(value);
  const today = todayIST();

  function setDay(which: 'from' | 'to', day: string) {
    const next = { ...value, [which]: day };
    // Picking a start after the end (or vice versa) almost always means "I
    // moved on to a different period", so drag the other end along rather
    // than showing an empty, inverted range.
    if (next.from && next.to && next.from > next.to) {
      if (which === 'from') next.to = next.from;
      else next.from = next.to;
    }
    onChange(next);
  }

  return (
    <div className="range-picker">
      <div className="range-presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`range-chip ${active === p.key ? 'active' : ''}`}
            onClick={() => onChange(presetRange(p.key))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="range-inputs">
        <label className="range-field">
          <span>From</span>
          <input
            type="date"
            className="input"
            value={value.from}
            max={value.to || today}
            onChange={(e) => setDay('from', e.target.value)}
          />
        </label>
        <span className="range-dash">&ndash;</span>
        <label className="range-field">
          <span>To</span>
          <input
            type="date"
            className="input"
            value={value.to}
            min={value.from || undefined}
            max={today}
            onChange={(e) => setDay('to', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

/** Human description of a range, e.g. "1 Oct – 22 Oct 2026" or "All time". */
export function describeRange(range: DayRange): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  if (!range.from && !range.to) return 'All time';
  if (range.from && range.to && range.from === range.to) return fmt(range.from);
  if (range.from && range.to) return `${fmt(range.from)} – ${fmt(range.to)}`;
  if (range.from) return `Since ${fmt(range.from)}`;
  return `Up to ${fmt(range.to)}`;
}

/**
 * Headline revenue for a stat tile: the main currency large, any others on a
 * smaller line below. Joining them with "+" at headline size wraps into an
 * unreadable block once a second currency appears.
 */
export function RevenueStat({ revenue }: { revenue?: Record<string, number> | null }) {
  const entries = Object.entries(revenue ?? {}).filter(([, v]) => v > 0);
  entries.sort(([a], [b]) => (a === 'INR' ? -1 : b === 'INR' ? 1 : a.localeCompare(b)));
  const [first, ...rest] = entries.length ? entries : [['INR', 0] as [string, number]];

  return (
    <>
      <div className="stat-value blue">{formatAmount(first[1], first[0])}</div>
      {rest.map(([cur, v]) => (
        <div key={cur} className="stat-secondary">
          + {formatAmount(v, cur)}
        </div>
      ))}
    </>
  );
}
