/**
 * Date-range helpers shared by the dashboard and transactions views.
 *
 * Ranges are picked as calendar days (YYYY-MM-DD) and interpreted in India
 * time. Postgres stores timestamps in UTC, so "22 Oct" must become
 * 21 Oct 18:30 UTC → 22 Oct 18:30 UTC. Using UTC midnight instead would drop
 * every payment made between midnight and 5:30am IST into the previous day.
 *
 * No imports, so this is safe in both server routes and 'use client' pages.
 */

export const RANGE_TIMEZONE_OFFSET = '+05:30';
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDay(value: string | null | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00${RANGE_TIMEZONE_OFFSET}`).getTime());
}

/**
 * Inclusive day range → half-open UTC instant range for a SQL filter:
 * created_at >= gte AND created_at < lt. Either end may be omitted.
 */
export function dayRangeToInstants(from?: string | null, to?: string | null) {
  const out: { gte?: string; lt?: string } = {};

  if (isValidDay(from)) {
    out.gte = new Date(`${from}T00:00:00${RANGE_TIMEZONE_OFFSET}`).toISOString();
  }
  if (isValidDay(to)) {
    // Exclusive upper bound: the start of the day AFTER `to`, so the whole of
    // `to` is included regardless of time precision.
    const end = new Date(`${to}T00:00:00${RANGE_TIMEZONE_OFFSET}`);
    end.setUTCDate(end.getUTCDate() + 1);
    out.lt = end.toISOString();
  }
  return out;
}

/** Today's calendar date in India, as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD by whole days. */
export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface DayRange {
  from: string; // '' = unbounded
  to: string;
}

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'all';

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'all', label: 'All time' },
];

export function presetRange(key: PresetKey, now: Date = new Date()): DayRange {
  const today = todayIST(now);
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case 'last7':
      return { from: addDays(today, -6), to: today };
    case 'last30':
      return { from: addDays(today, -29), to: today };
    case 'thisMonth':
      return { from: firstOfMonth, to: today };
    case 'lastMonth': {
      const lastOfPrev = addDays(firstOfMonth, -1);
      return { from: `${lastOfPrev.slice(0, 7)}-01`, to: lastOfPrev };
    }
    case 'all':
      return { from: '', to: '' };
  }
}

/** Which preset (if any) a range corresponds to, for highlighting its chip. */
export function matchPreset(range: DayRange, now: Date = new Date()): PresetKey | null {
  for (const { key } of PRESETS) {
    const p = presetRange(key, now);
    if (p.from === range.from && p.to === range.to) return key;
  }
  return null;
}

/**
 * The selected range lives in the page URL so a refresh, bookmark or shared
 * link keeps it. Default when nothing is given: the last 30 days, matching
 * what the dashboard always showed before a picker existed.
 */
export function rangeFromParams(
  sp: { get(name: string): string | null } | null | undefined
): DayRange {
  if (sp?.get('range') === 'all') return { from: '', to: '' };
  const from = sp?.get('from');
  const to = sp?.get('to');
  if (isValidDay(from) || isValidDay(to)) {
    return { from: isValidDay(from) ? from : '', to: isValidDay(to) ? to : '' };
  }
  return presetRange('last30');
}

/** Serialise a range for a URL. "All time" is explicit so it survives reload. */
export function rangeQuery(range: DayRange): string {
  if (!range.from && !range.to) return 'range=all';
  const parts: string[] = [];
  if (range.from) parts.push(`from=${range.from}`);
  if (range.to) parts.push(`to=${range.to}`);
  return parts.join('&');
}
