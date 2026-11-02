// Wall-date arithmetic.
//
// Everything here works on plain "YYYY-MM-DD" strings (a household's calendar
// day) and minutes-since-midnight, never on a Date's local getters. A kiosk's
// own clock is often UTC while the household lives somewhere else, so a Date
// built from the kiosk's zone would put a 9 pm event on the wrong day. The
// only place an instant becomes a wall date is `wallParts`, which reads it in
// the household's time zone.

export type Ymd = string;
export type WeekStart = 0 | 1;

const MS_DAY = 86_400_000;

export interface Parts {
  y: number;
  m: number;
  d: number;
}

export function parseYmd(s: Ymd): Parts {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function utcMs(s: Ymd): number {
  const { y, m, d } = parseYmd(s);
  return Date.UTC(y, m - 1, d);
}

export function fromUtcMs(ms: number): Ymd {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isYmd(s: unknown): s is Ymd {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(s: Ymd, n: number): Ymd {
  return fromUtcMs(utcMs(s) + n * MS_DAY);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((utcMs(b) - utcMs(a)) / MS_DAY);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(s: Ymd): number {
  return new Date(utcMs(s)).getUTCDay();
}

export function startOfWeek(s: Ymd, weekStart: WeekStart): Ymd {
  const back = (weekday(s) - weekStart + 7) % 7;
  return addDays(s, -back);
}

export function startOfMonth(s: Ymd): Ymd {
  const { y, m } = parseYmd(s);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

export function daysInMonth(s: Ymd): number {
  const { y, m } = parseYmd(s);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Move by whole months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(s: Ymd, n: number): Ymd {
  const { y, m, d } = parseYmd(s);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const ny = first.getUTCFullYear();
  const nm = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function sameMonth(a: Ymd, b: Ymd): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Rows of 7 days covering the anchor's month, starting on `weekStart`. */
export function monthGrid(anchor: Ymd, weekStart: WeekStart): Ymd[][] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first, weekStart);
  const last = addDays(first, daysInMonth(first) - 1);
  const weeks = Math.ceil((diffDays(gridStart, last) + 1) / 7);
  const rows: Ymd[][] = [];
  for (let w = 0; w < weeks; w++) {
    rows.push(Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i)));
  }
  return rows;
}

// ── Instants -> wall time ────────────────────────────────────────────────────

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string | undefined): Intl.DateTimeFormat {
  const key = tz ?? '';
  let f = formatters.get(key);
  if (!f) {
    const options: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };
    try {
      f = new Intl.DateTimeFormat('en-US', tz ? { ...options, timeZone: tz } : options);
    } catch {
      // A bad zone name must not take the whole calendar down.
      f = new Intl.DateTimeFormat('en-US', options);
    }
    formatters.set(key, f);
  }
  return f;
}

export interface WallParts {
  ymd: Ymd;
  /** Minutes since midnight on that day, 0..1439. */
  minutes: number;
}

/** The household's clock reading for an instant. */
export function wallParts(ms: number, tz: string | undefined): WallParts {
  const out: Record<string, string> = {};
  for (const p of formatterFor(tz).formatToParts(new Date(ms))) out[p.type] = p.value;
  const hour = Number(out.hour) % 24;
  return {
    ymd: `${out.year}-${out.month}-${out.day}`,
    minutes: hour * 60 + Number(out.minute),
  };
}

export function todayYmd(nowMs: number, tz: string | undefined): Ymd {
  return wallParts(nowMs, tz).ymd;
}

/** Position on one continuous wall-clock axis, for sorting across days. */
export function wallAxis(ymd: Ymd, minutes: number): number {
  return utcMs(ymd) + minutes * 60_000;
}

// ── Labels (locale-aware, zone-proof) ────────────────────────────────────────
//
// A wall date is formatted as if it were UTC so the kiosk's zone never shifts it.

const labelFormatters = new Map<string, Intl.DateTimeFormat>();

function labelFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = labelFormatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
    }
    labelFormatters.set(key, f);
  }
  return f;
}

export function formatDay(s: Ymd, locale: string, options: Intl.DateTimeFormatOptions): string {
  return labelFormatter(locale, options).format(new Date(utcMs(s)));
}

/** Minutes since midnight as a clock label in the household's 12h/24h style. */
export function formatClock(
  minutes: number,
  locale: string,
  hour12: boolean,
  compact = false,
): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const date = new Date(Date.UTC(2000, 0, 1, h, min));
  if (!compact || !hour12) {
    return labelFormatter(locale, {
      hour: hour12 ? 'numeric' : '2-digit',
      minute: '2-digit',
      hour12,
    }).format(date);
  }
  // Compact 12-hour: "9a", "9:30p" - short enough for a narrow week column.
  const base = labelFormatter(locale, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  const match = /^(\d{1,2})[:.](\d{2})\s*([^\d\s]+)$/.exec(base.replace(/ | /g, ' ').trim());
  if (!match) return base;
  const [, hh, mm, suffix] = match;
  const short = suffix.replace(/[^A-Za-z]/g, '').slice(0, 1).toLowerCase() || suffix;
  return mm === '00' ? `${hh}${short}` : `${hh}:${mm}${short}`;
}

/** An hour-of-day label for the Day view gutter: "9 AM" or "09". */
export function formatHour(hour: number, locale: string, hour12: boolean): string {
  const date = new Date(Date.UTC(2000, 0, 1, hour % 24, 0));
  return labelFormatter(locale, { hour: hour12 ? 'numeric' : '2-digit', hour12 }).format(date);
}

/** Whether the household wants a 12-hour clock. */
export function wantsHour12(timeFormat: unknown, locale: string): boolean {
  if (timeFormat === '12h') return true;
  if (timeFormat === '24h') return false;
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
  } catch {
    return true;
  }
}
