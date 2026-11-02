import type { CalendarEvent } from '../types';
import { addDays, diffDays, isYmd, wallAxis, wallParts, type Ymd } from './dates';

// Events come from the host as either:
//   all-day  "2026-03-22" .. "2026-03-23"   wall dates, end day EXCLUSIVE
//   timed    ISO instants ("...Z" or "+01:00") which must be read in the
//            household's time zone to find the day they belong to
//
// `normalizeEvent` turns both into one shape on the household's wall clock so
// every view can bucket, sort and lay out events without touching a Date.

export interface NormEvent {
  raw: CalendarEvent;
  id: string;
  title: string;
  allDay: boolean;
  /** First day the event appears on. */
  startYmd: Ymd;
  /** All-day: the day AFTER the last day (exclusive). Timed: the day it ends on. */
  endYmd: Ymd;
  /** Timed only. Minutes since midnight on startYmd / endYmd. */
  startMin: number;
  endMin: number;
  /** Sort key on a single wall-clock axis. */
  axis: number;
}

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;
const WALL_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/;

function timedParts(value: string, tz: string | undefined): { ymd: Ymd; minutes: number } | null {
  const text = value.trim();
  if (HAS_ZONE.test(text)) {
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? wallParts(ms, tz) : null;
  }
  // A zone-less timed string is already a wall time.
  const m = WALL_TIME.exec(text);
  if (m) return { ymd: m[1], minutes: Number(m[2]) * 60 + Number(m[3]) };
  return isYmd(text.slice(0, 10)) ? { ymd: text.slice(0, 10), minutes: 0 } : null;
}

export function normalizeEvent(ev: CalendarEvent, tz: string | undefined): NormEvent | null {
  if (!ev || typeof ev.start !== 'string' || !ev.start) return null;
  const title = typeof ev.title === 'string' && ev.title.trim() ? ev.title.trim() : '(No title)';
  const id = String(ev.id ?? `${ev.start}-${title}`);
  const allDay = ev.allDay === true || !ev.start.includes('T');

  if (allDay) {
    const startYmd = ev.start.slice(0, 10);
    if (!isYmd(startYmd)) return null;
    let endYmd = typeof ev.end === 'string' ? ev.end.slice(0, 10) : '';
    if (!isYmd(endYmd) || diffDays(startYmd, endYmd) < 1) endYmd = addDays(startYmd, 1);
    return { raw: ev, id, title, allDay, startYmd, endYmd, startMin: 0, endMin: 0, axis: wallAxis(startYmd, 0) };
  }

  const start = timedParts(ev.start, tz);
  if (!start) return null;
  let end = typeof ev.end === 'string' && ev.end ? timedParts(ev.end, tz) : null;
  // Bad feeds exist: no end, or an end before the start. Treat as an instant.
  if (!end || wallAxis(end.ymd, end.minutes) < wallAxis(start.ymd, start.minutes)) end = start;
  return {
    raw: ev,
    id,
    title,
    allDay,
    startYmd: start.ymd,
    endYmd: end.ymd,
    startMin: start.minutes,
    endMin: end.minutes,
    axis: wallAxis(start.ymd, start.minutes),
  };
}

export function normalizeAll(events: readonly CalendarEvent[] | null | undefined, tz: string | undefined): NormEvent[] {
  const out: NormEvent[] = [];
  const seen = new Set<string>();
  for (const ev of events ?? []) {
    const n = normalizeEvent(ev, tz);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

/** Whether an event shows on a given day. Timed ends are exclusive at midnight. */
export function occursOn(e: NormEvent, ymd: Ymd): boolean {
  if (e.allDay) return e.startYmd <= ymd && ymd < e.endYmd;
  if (e.startYmd === ymd) return true;
  if (e.startYmd > ymd) return false;
  return ymd < e.endYmd || (ymd === e.endYmd && e.endMin > 0);
}

export function compareEvents(a: NormEvent, b: NormEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.axis - b.axis || a.title.localeCompare(b.title);
}

export interface DayBucket {
  allDay: NormEvent[];
  timed: NormEvent[];
}

/** Every day in [from, to] mapped to its events, built once per render. */
export function bucketByDay(events: readonly NormEvent[], from: Ymd, to: Ymd): Map<Ymd, DayBucket> {
  const map = new Map<Ymd, DayBucket>();
  const days = Math.max(0, diffDays(from, to));
  for (let i = 0; i <= days; i++) map.set(addDays(from, i), { allDay: [], timed: [] });
  for (const e of events) {
    const first = e.startYmd < from ? from : e.startYmd;
    const lastDay = e.allDay ? addDays(e.endYmd, -1) : e.endYmd;
    const last = lastDay > to ? to : lastDay;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (!occursOn(e, d)) continue;
      const bucket = map.get(d);
      if (bucket) (e.allDay ? bucket.allDay : bucket.timed).push(e);
    }
  }
  for (const bucket of map.values()) {
    bucket.allDay.sort(compareEvents);
    bucket.timed.sort(compareEvents);
  }
  return map;
}

// ── Timeline layout (Day view) ───────────────────────────────────────────────

export interface Placed {
  event: NormEvent;
  /** Minutes since midnight, clipped to this day. */
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

/** The part of a timed event that falls on `ymd`, never shorter than `minLen`. */
export function clipToDay(e: NormEvent, ymd: Ymd, minLen = 30): { startMin: number; endMin: number } {
  const startMin = e.startYmd === ymd ? e.startMin : 0;
  let endMin = e.endYmd === ymd ? e.endMin : 1440;
  if (endMin - startMin < minLen) endMin = Math.min(1440, startMin + minLen);
  return { startMin, endMin };
}

/** Side-by-side columns for overlapping events, like every day grid. */
export function layoutTimeline(timed: readonly NormEvent[], ymd: Ymd): Placed[] {
  const items = timed
    .map((event) => ({ event, ...clipToDay(event, ymd) }))
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    for (const p of cluster) p.cols = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    let col = columnEnds.findIndex((end) => end <= item.startMin);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(item.endMin);
    } else {
      columnEnds[col] = item.endMin;
    }
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return placed;
}

/** Events running at `minutes` on `ymd`, for the "happening now" cue. */
export function isRunning(e: NormEvent, ymd: Ymd, minutes: number): boolean {
  if (e.allDay || !occursOn(e, ymd)) return false;
  const { startMin, endMin } = clipToDay(e, ymd, 1);
  return minutes >= startMin && minutes < endMin;
}

export function isOver(e: NormEvent, ymd: Ymd, minutes: number, today: Ymd): boolean {
  if (ymd < today) return true;
  if (ymd > today || e.allDay) return false;
  return clipToDay(e, ymd, 1).endMin <= minutes;
}
