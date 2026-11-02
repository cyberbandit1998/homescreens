import type { CalendarViewId } from '../types';
import { S } from '../strings';
import { addDays, addMonths, formatClock, formatDay, monthGrid, startOfMonth, startOfWeek, type WeekStart, type Ymd } from './dates';
import type { NormEvent } from './events';

export interface TimeStyle {
  locale: string;
  hour12: boolean;
}

/** "9:30 AM – 10:15 AM" for a timed event on `day`, or a continuation cue. */
export function eventTimeLabel(e: NormEvent, day: Ymd, t: TimeStyle, compact = false): string {
  if (e.allDay) return S.allDay;
  const starts = e.startYmd === day;
  const ends = e.endYmd === day;
  const fmt = (min: number) => formatClock(min, t.locale, t.hour12, compact);
  if (starts && (ends || e.endMin === e.startMin)) {
    return e.endMin === e.startMin ? fmt(e.startMin) : `${fmt(e.startMin)} – ${fmt(e.endMin)}`;
  }
  if (starts) return S.from(fmt(e.startMin));
  if (ends) return S.until(fmt(e.endMin));
  return S.continues;
}

/** A title for the visible range, in the household's language. */
export function rangeLabel(view: CalendarViewId, anchor: Ymd, weekStart: WeekStart, locale: string, todayYear: string): string {
  if (view === 'day') {
    const sameYear = anchor.slice(0, 4) === todayYear;
    return formatDay(anchor, locale, sameYear
      ? { weekday: 'long', month: 'long', day: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (view === 'month') return formatDay(anchor, locale, { month: 'long', year: 'numeric' });
  const first = view === 'week' ? startOfWeek(anchor, weekStart) : anchor;
  const last = addDays(first, view === 'week' ? 6 : 13);
  return formatRange(first, last, locale);
}

function formatRange(a: Ymd, b: Ymd, locale: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  try {
    const f = new Intl.DateTimeFormat(locale, opts) as Intl.DateTimeFormat & {
      formatRange?: (x: Date, y: Date) => string;
    };
    const da = new Date(`${a}T00:00:00Z`);
    const db = new Date(`${b}T00:00:00Z`);
    if (typeof f.formatRange === 'function') return f.formatRange(da, db);
  } catch {
    /* fall through to the plain join */
  }
  return `${formatDay(a, locale, { month: 'short', day: 'numeric' })} – ${formatDay(b, locale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/** Where "previous" and "next" go for each view. */
export function stepAnchor(view: CalendarViewId, anchor: Ymd, direction: -1 | 1): Ymd {
  switch (view) {
    case 'day':
      return addDays(anchor, direction);
    case 'month':
      return addMonths(anchor, direction);
    default:
      return addDays(anchor, 7 * direction);
  }
}

/** "Today", "Tomorrow", or "Wed, Nov 4". */
export function dayHeading(day: Ymd, today: Ymd, locale: string): { relative: string | null; date: string } {
  const date = formatDay(day, locale, { weekday: 'short', month: 'short', day: 'numeric' });
  if (day === today) return { relative: S.today, date };
  if (day === addDays(today, 1)) return { relative: S.tomorrow, date };
  if (day === addDays(today, -1)) return { relative: S.yesterday, date };
  return { relative: null, date };
}

/** The first and last wall day a view draws (inclusive). */
export function visibleRange(view: CalendarViewId, anchor: Ymd, weekStart: WeekStart): { from: Ymd; to: Ymd } {
  switch (view) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = startOfWeek(anchor, weekStart);
      return { from, to: addDays(from, 6) };
    }
    case 'month': {
      const rows = monthGrid(anchor, weekStart);
      return { from: rows[0][0], to: rows[rows.length - 1][6] };
    }
    default:
      return { from: anchor, to: addDays(anchor, 13) };
  }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * Calendar descriptions sometimes arrive as HTML (Google does this). We show
 * text only: line breaks kept, every tag dropped, nothing ever injected.
 */
export function plainText(input: string | undefined): string {
  if (!input) return '';
  return input
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface FetchWindow {
  /** First and last wall day the window covers (inclusive). */
  from: Ymd;
  to: Ymd;
  /** ISO instants for /api/calendar, padded a day each side for time zones. */
  timeMin: string;
  timeMax: string;
}

/**
 * The span asked of /api/calendar. It covers last month, this month and next
 * month plus a week either side, so paging around the visible month never
 * triggers a new request. Stable all month, so the URL (and the host's cache
 * key) does not change from one render to the next.
 */
export function fetchWindow(anchor: Ymd): FetchWindow {
  const from = addDays(startOfMonth(addMonths(anchor, -1)), -7);
  const to = addDays(startOfMonth(addMonths(anchor, 2)), 6);
  return {
    from,
    to,
    timeMin: `${addDays(from, -1)}T00:00:00.000Z`,
    timeMax: `${addDays(to, 2)}T00:00:00.000Z`,
  };
}
