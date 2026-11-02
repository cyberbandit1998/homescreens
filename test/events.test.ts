import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../src/types';
import {
  bucketByDay,
  clipToDay,
  isOver,
  isRunning,
  layoutTimeline,
  normalizeAll,
  normalizeEvent,
  occursOn,
} from '../src/lib/events';

const CHI = 'America/Chicago';

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e1',
  title: 'Thing',
  start: '2026-11-02T15:00:00.000Z',
  end: '2026-11-02T16:00:00.000Z',
  allDay: false,
  ...over,
});

describe('normalizeEvent', () => {
  it('puts a timed instant on the household day, not the UTC day', () => {
    // 02:00 UTC on Nov 3 is 8 pm on Nov 2 in Chicago (CST, UTC-6).
    const n = normalizeEvent(ev({ start: '2026-11-03T02:00:00.000Z', end: '2026-11-03T03:30:00.000Z' }), CHI)!;
    expect(n.startYmd).toBe('2026-11-02');
    expect(n.startMin).toBe(20 * 60);
    expect(n.endMin).toBe(21 * 60 + 30);
  });

  it('reads Google-style offsets', () => {
    const n = normalizeEvent(ev({ start: '2026-11-02T09:30:00-06:00', end: '2026-11-02T10:00:00-06:00' }), CHI)!;
    expect(n.startYmd).toBe('2026-11-02');
    expect(n.startMin).toBe(9 * 60 + 30);
  });

  it('treats a zone-less timed string as a wall time', () => {
    const n = normalizeEvent(ev({ start: '2026-11-02T09:30:00', end: '2026-11-02T10:00:00' }), CHI)!;
    expect(n.startMin).toBe(9 * 60 + 30);
  });

  it('keeps all-day events on their wall dates with an exclusive end', () => {
    const n = normalizeEvent(ev({ allDay: true, start: '2026-11-02', end: '2026-11-04' }), CHI)!;
    expect(n.allDay).toBe(true);
    expect(n.startYmd).toBe('2026-11-02');
    expect(n.endYmd).toBe('2026-11-04');
  });

  it('repairs an all-day event with a missing or backwards end', () => {
    expect(normalizeEvent(ev({ allDay: true, start: '2026-11-02', end: '' }), CHI)!.endYmd).toBe('2026-11-03');
    expect(normalizeEvent(ev({ allDay: true, start: '2026-11-02', end: '2026-11-01' }), CHI)!.endYmd).toBe('2026-11-03');
  });

  it('treats a date-only start as all-day even without the flag', () => {
    expect(normalizeEvent(ev({ allDay: false, start: '2026-11-02', end: '2026-11-03' }), CHI)!.allDay).toBe(true);
  });

  it('treats an end before the start as an instant', () => {
    const n = normalizeEvent(ev({ start: '2026-11-02T15:00:00.000Z', end: '2026-11-02T14:00:00.000Z' }), CHI)!;
    expect(n.endMin).toBe(n.startMin);
  });

  it('drops events it cannot read and titles blank ones', () => {
    expect(normalizeEvent(ev({ start: '' }), CHI)).toBeNull();
    expect(normalizeEvent(ev({ allDay: true, start: 'garbage' }), CHI)).toBeNull();
    expect(normalizeEvent(ev({ title: '   ' }), CHI)!.title).toBe('(No title)');
  });

  it('removes duplicate ids', () => {
    expect(normalizeAll([ev({}), ev({})], CHI)).toHaveLength(1);
    expect(normalizeAll(null, CHI)).toEqual([]);
  });
});

describe('occursOn', () => {
  it('covers every day of a multi-day all-day event, end exclusive', () => {
    const n = normalizeEvent(ev({ allDay: true, start: '2026-11-02', end: '2026-11-04' }), CHI)!;
    expect(occursOn(n, '2026-11-01')).toBe(false);
    expect(occursOn(n, '2026-11-02')).toBe(true);
    expect(occursOn(n, '2026-11-03')).toBe(true);
    expect(occursOn(n, '2026-11-04')).toBe(false);
  });

  it('carries an overnight event into the next morning', () => {
    // 10 pm to 6 am Chicago time.
    const n = normalizeEvent(ev({ start: '2026-11-03T04:00:00.000Z', end: '2026-11-03T12:00:00.000Z' }), CHI)!;
    expect(occursOn(n, '2026-11-02')).toBe(true);
    expect(occursOn(n, '2026-11-03')).toBe(true);
    expect(occursOn(n, '2026-11-04')).toBe(false);
  });

  it('does not spill an event that ends exactly at midnight', () => {
    // 11 pm to midnight.
    const n = normalizeEvent(ev({ start: '2026-11-03T05:00:00.000Z', end: '2026-11-03T06:00:00.000Z' }), CHI)!;
    expect(occursOn(n, '2026-11-02')).toBe(true);
    expect(occursOn(n, '2026-11-03')).toBe(false);
  });
});

describe('bucketByDay', () => {
  it('splits all-day and timed events and sorts them', () => {
    const list = normalizeAll(
      [
        ev({ id: 'late', title: 'Late', start: '2026-11-02T22:00:00.000Z', end: '2026-11-02T23:00:00.000Z' }),
        ev({ id: 'early', title: 'Early', start: '2026-11-02T14:00:00.000Z', end: '2026-11-02T15:00:00.000Z' }),
        ev({ id: 'trip', title: 'Trip', allDay: true, start: '2026-11-02', end: '2026-11-05' }),
      ],
      CHI,
    );
    const map = bucketByDay(list, '2026-11-01', '2026-11-07');
    const mon = map.get('2026-11-02')!;
    expect(mon.allDay.map((e) => e.id)).toEqual(['trip']);
    expect(mon.timed.map((e) => e.id)).toEqual(['early', 'late']);
    expect(map.get('2026-11-04')!.allDay.map((e) => e.id)).toEqual(['trip']);
    expect(map.get('2026-11-05')!.allDay).toEqual([]);
    expect(map.get('2026-11-01')!.timed).toEqual([]);
  });

  it('ignores events outside the range', () => {
    const list = normalizeAll([ev({ allDay: true, start: '2027-01-01', end: '2027-01-02' })], CHI);
    const map = bucketByDay(list, '2026-11-01', '2026-11-07');
    expect([...map.values()].every((b) => b.allDay.length === 0)).toBe(true);
  });
});

describe('timeline layout', () => {
  const timed = (id: string, start: string, end: string) =>
    normalizeEvent(ev({ id, start, end }), 'UTC')!;

  it('puts overlapping events side by side', () => {
    const a = timed('a', '2026-11-02T09:00:00Z', '2026-11-02T10:30:00Z');
    const b = timed('b', '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z');
    const c = timed('c', '2026-11-02T13:00:00Z', '2026-11-02T14:00:00Z');
    const placed = layoutTimeline([a, b, c], '2026-11-02');
    const byId = Object.fromEntries(placed.map((p) => [p.event.id, p]));
    expect(byId.a.cols).toBe(2);
    expect(byId.b.cols).toBe(2);
    expect(byId.a.col).not.toBe(byId.b.col);
    expect(byId.c.cols).toBe(1);
    expect(byId.c.col).toBe(0);
  });

  it('reuses a freed column inside a cluster', () => {
    const a = timed('a', '2026-11-02T09:00:00Z', '2026-11-02T12:00:00Z');
    const b = timed('b', '2026-11-02T09:00:00Z', '2026-11-02T10:00:00Z');
    const c = timed('c', '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z');
    const placed = layoutTimeline([a, b, c], '2026-11-02');
    expect(placed.every((p) => p.cols === 2)).toBe(true);
    expect(placed.find((p) => p.event.id === 'c')!.col).toBe(placed.find((p) => p.event.id === 'b')!.col);
  });

  it('clips to the day and gives short events a visible height', () => {
    const night = timed('n', '2026-11-02T22:00:00Z', '2026-11-03T06:00:00Z');
    expect(clipToDay(night, '2026-11-02')).toEqual({ startMin: 22 * 60, endMin: 1440 });
    expect(clipToDay(night, '2026-11-03')).toEqual({ startMin: 0, endMin: 6 * 60 });
    const instant = timed('i', '2026-11-02T09:00:00Z', '2026-11-02T09:00:00Z');
    expect(clipToDay(instant, '2026-11-02')).toEqual({ startMin: 9 * 60, endMin: 9 * 60 + 30 });
  });
});

describe('now cues', () => {
  const e = normalizeEvent(ev({ start: '2026-11-02T09:00:00Z', end: '2026-11-02T10:00:00Z' }), 'UTC')!;
  it('knows when an event is running or over', () => {
    expect(isRunning(e, '2026-11-02', 9 * 60 + 30)).toBe(true);
    expect(isRunning(e, '2026-11-02', 10 * 60)).toBe(false);
    expect(isOver(e, '2026-11-02', 10 * 60, '2026-11-02')).toBe(true);
    expect(isOver(e, '2026-11-02', 8 * 60, '2026-11-02')).toBe(false);
    expect(isOver(e, '2026-11-02', 0, '2026-11-03')).toBe(true);
    expect(isOver(e, '2026-11-02', 0, '2026-11-01')).toBe(false);
  });
});
