import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  formatClock,
  formatDay,
  monthGrid,
  startOfMonth,
  startOfWeek,
  todayYmd,
  wallParts,
  wantsHour12,
  weekday,
} from '../src/lib/dates';

describe('wall-date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts whole days in either direction', () => {
    expect(diffDays('2026-11-02', '2026-11-09')).toBe(7);
    expect(diffDays('2026-11-09', '2026-11-02')).toBe(-7);
    // The clocks change in spring; a calendar day count must not.
    expect(diffDays('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('finds the weekday and week start', () => {
    expect(weekday('2026-11-02')).toBe(1); // Monday
    expect(startOfWeek('2026-11-04', 0)).toBe('2026-11-01');
    expect(startOfWeek('2026-11-04', 1)).toBe('2026-11-02');
    expect(startOfWeek('2026-11-01', 1)).toBe('2026-10-26');
  });

  it('moves by months and clamps the day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15');
    expect(startOfMonth('2026-11-17')).toBe('2026-11-01');
  });

  it('builds a month grid that starts on the chosen weekday', () => {
    const sun = monthGrid('2026-11-10', 0);
    expect(sun[0][0]).toBe('2026-11-01');
    expect(sun).toHaveLength(5);
    const mon = monthGrid('2026-11-10', 1);
    expect(mon[0][0]).toBe('2026-10-26');
    expect(mon.every((row) => row.length === 7)).toBe(true);
    // February 2026 starts on a Sunday: exactly four rows.
    expect(monthGrid('2026-02-10', 0)).toHaveLength(4);
    // A month that spills into a sixth row.
    expect(monthGrid('2026-08-10', 0)).toHaveLength(6);
  });
});

describe('instants on the household clock', () => {
  it('reads an instant in the household zone, not the kiosk zone', () => {
    // 02:30 UTC is still the evening before in Chicago.
    expect(wallParts(Date.parse('2026-07-01T01:00:00Z'), 'America/Chicago')).toEqual({
      ymd: '2026-06-30',
      minutes: 20 * 60,
    });
    expect(wallParts(Date.parse('2026-01-15T01:30:00Z'), 'America/Chicago')).toEqual({
      ymd: '2026-01-14',
      minutes: 19 * 60 + 30,
    });
    expect(wallParts(Date.parse('2026-07-01T22:00:00Z'), 'Pacific/Auckland')).toEqual({
      ymd: '2026-07-02',
      minutes: 10 * 60,
    });
  });

  it('never reports hour 24 at midnight', () => {
    expect(wallParts(Date.parse('2026-07-01T05:00:00Z'), 'America/Chicago').minutes).toBe(0);
  });

  it('survives a bad zone name', () => {
    expect(() => todayYmd(Date.now(), 'Not/AZone')).not.toThrow();
  });
});

describe('labels', () => {
  it('formats a wall date without the kiosk zone shifting it', () => {
    expect(formatDay('2026-11-02', 'en-US', { weekday: 'long' })).toBe('Monday');
    expect(formatDay('2026-11-02', 'en-US', { month: 'long', year: 'numeric' })).toBe('November 2026');
    expect(formatDay('2026-11-02', 'de-DE', { weekday: 'long' })).toBe('Montag');
  });

  it('formats clock times in both styles', () => {
    expect(formatClock(9 * 60 + 30, 'en-US', true)).toMatch(/^9:30\sAM$/);
    expect(formatClock(15 * 60, 'en-US', true)).toMatch(/^3:00\sPM$/);
    expect(formatClock(15 * 60 + 5, 'en-US', false)).toBe('15:05');
    expect(formatClock(0, 'en-US', false)).toBe('00:00');
  });

  it('formats compact 12-hour times for narrow columns', () => {
    expect(formatClock(9 * 60, 'en-US', true, true)).toBe('9a');
    expect(formatClock(15 * 60 + 30, 'en-US', true, true)).toBe('3:30p');
    expect(formatClock(12 * 60, 'en-US', true, true)).toBe('12p');
  });

  it('honors the household clock preference', () => {
    expect(wantsHour12('12h', 'de-DE')).toBe(true);
    expect(wantsHour12('24h', 'en-US')).toBe(false);
    expect(wantsHour12(undefined, 'en-US')).toBe(true);
    expect(wantsHour12(undefined, 'de-DE')).toBe(false);
  });
});
