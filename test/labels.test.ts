import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/dates';
import { normalizeEvent } from '../src/lib/events';
import { dayHeading, eventTimeLabel, fetchWindow, plainText, rangeLabel, stepAnchor, visibleRange } from '../src/lib/labels';
import type { CalendarEvent } from '../src/types';

const t = { locale: 'en-US', hour12: true };
const make = (over: Partial<CalendarEvent>) =>
  normalizeEvent(
    { id: 'x', title: 'X', start: '2026-11-02T15:00:00Z', end: '2026-11-02T16:30:00Z', allDay: false, ...over },
    'UTC',
  )!;

describe('eventTimeLabel', () => {
  it('shows a range for a same-day event', () => {
    expect(eventTimeLabel(make({}), '2026-11-02', t)).toMatch(/^3:00\sPM\s–\s4:30\sPM$/);
  });

  it('shows a single time for an instant', () => {
    expect(eventTimeLabel(make({ end: '2026-11-02T15:00:00Z' }), '2026-11-02', t)).toMatch(/^3:00\sPM$/);
  });

  it('says All day for all-day events', () => {
    expect(eventTimeLabel(make({ allDay: true, start: '2026-11-02', end: '2026-11-03' }), '2026-11-02', t)).toBe('All day');
  });

  it('describes each day of an overnight event differently', () => {
    const night = make({ start: '2026-11-02T22:00:00Z', end: '2026-11-03T06:00:00Z' });
    expect(eventTimeLabel(night, '2026-11-02', t)).toMatch(/^From 10:00\sPM$/);
    expect(eventTimeLabel(night, '2026-11-03', t)).toMatch(/^Until 6:00\sAM$/);
  });

  it('uses the compact style for narrow columns', () => {
    expect(eventTimeLabel(make({}), '2026-11-02', t, true)).toBe('3p – 4:30p');
  });
});

describe('titles and navigation', () => {
  it('titles each view', () => {
    expect(rangeLabel('month', '2026-11-12', 0, 'en-US', '2026')).toBe('November 2026');
    expect(rangeLabel('day', '2026-11-02', 0, 'en-US', '2026')).toBe('Monday, November 2');
    expect(rangeLabel('day', '2027-01-04', 0, 'en-US', '2026')).toBe('Monday, January 4, 2027');
    expect(rangeLabel('week', '2026-11-04', 0, 'en-US', '2026')).toMatch(/Nov 1\s–\s7,\s2026/);
    expect(rangeLabel('week', '2026-11-04', 1, 'en-US', '2026')).toMatch(/Nov 2\s–\s8,\s2026/);
  });

  it('steps by the right amount', () => {
    expect(stepAnchor('day', '2026-11-02', 1)).toBe('2026-11-03');
    expect(stepAnchor('week', '2026-11-02', -1)).toBe('2026-10-26');
    expect(stepAnchor('month', '2026-01-31', 1)).toBe('2026-02-28');
    expect(stepAnchor('schedule', '2026-11-02', 1)).toBe('2026-11-09');
  });

  it('names nearby days', () => {
    expect(dayHeading('2026-11-02', '2026-11-02', 'en-US').relative).toBe('Today');
    expect(dayHeading('2026-11-03', '2026-11-02', 'en-US').relative).toBe('Tomorrow');
    expect(dayHeading('2026-11-01', '2026-11-02', 'en-US').relative).toBe('Yesterday');
    expect(dayHeading('2026-11-05', '2026-11-02', 'en-US')).toEqual({ relative: null, date: 'Thu, Nov 5' });
  });

  it('knows what each view draws', () => {
    expect(visibleRange('day', '2026-11-04', 0)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(visibleRange('week', '2026-11-04', 1)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(visibleRange('month', '2026-11-04', 0)).toEqual({ from: '2026-11-01', to: '2026-12-05' });
    expect(visibleRange('schedule', '2026-11-04', 0)).toEqual({ from: '2026-11-04', to: '2026-11-17' });
  });
});

describe('fetchWindow', () => {
  it('stays the same all month so the request is not repeated', () => {
    const a = fetchWindow('2026-11-02');
    expect(fetchWindow('2026-11-30')).toEqual(a);
    expect(fetchWindow('2026-12-01')).not.toEqual(a);
  });

  it('covers last month through next month', () => {
    const w = fetchWindow('2026-11-15');
    expect(w.from <= '2026-10-01').toBe(true);
    expect(w.to >= '2027-01-01').toBe(true);
  });

  it('always contains what any view draws, for any day of the year and either week start', () => {
    for (let i = 0; i < 366; i++) {
      const anchor = addDays('2026-01-01', i);
      const w = fetchWindow(anchor);
      for (const view of ['day', 'week', 'month', 'schedule'] as const) {
        for (const start of [0, 1] as const) {
          const r = visibleRange(view, anchor, start);
          expect(r.from >= w.from && r.to <= w.to, `${view} week-start ${start} on ${anchor}`).toBe(true);
        }
      }
    }
  });

  it('stays inside what the host allows (400 days) and pads for time zones', () => {
    const w = fetchWindow('2026-11-15');
    const days = (Date.parse(w.timeMax) - Date.parse(w.timeMin)) / 86_400_000;
    expect(days).toBeLessThan(400);
    expect(Date.parse(w.timeMin)).toBeLessThan(Date.parse(`${w.from}T00:00:00Z`));
    expect(Date.parse(w.timeMax)).toBeGreaterThan(Date.parse(`${w.to}T23:59:59Z`));
  });
});

describe('plainText', () => {
  it('keeps line breaks and drops tags', () => {
    expect(plainText('Hello<br>world<br/>again')).toBe('Hello\nworld\nagain');
    expect(plainText('<p>One</p><p>Two</p>')).toBe('One\nTwo');
  });

  it('never leaves markup behind', () => {
    const out = plainText('<img src=x onerror=alert(1)><script>alert(2)</script>safe <b>bold</b>');
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain('safe bold');
  });

  it('decodes the common entities', () => {
    expect(plainText('Tom &amp; Jerry &lt;3 &quot;hi&quot; it&#39;s&nbsp;fine')).toBe('Tom & Jerry <3 "hi" it\'s fine');
  });

  it('handles empty input', () => {
    expect(plainText(undefined)).toBe('');
    expect(plainText('   ')).toBe('');
  });
});
