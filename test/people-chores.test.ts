import { describe, expect, it } from 'vitest';
import type { CalendarEvent, Person } from '../src/types';
import { normalizeAll } from '../src/lib/events';
import { buildLegend, cleanPeople, colorOf, filterEvents, initials, ownersOf } from '../src/lib/people';
import { applyToggle, groupByTimeOfDay, parseChoresToday, parseFamily, progress } from '../src/lib/chores';

const e = (id: string, sourceId: string | undefined, color = '#ff0000', name = 'Cal'): CalendarEvent => ({
  id,
  title: id,
  start: '2026-11-02T15:00:00Z',
  end: '2026-11-02T16:00:00Z',
  allDay: false,
  sourceId,
  sourceName: name,
  calendarColor: color,
});

const people: Person[] = [
  { id: 'mia', name: 'Mia Lopez', color: '#e91e63', sourceIds: ['g-mia'] },
  { id: 'leo', name: 'Leo', color: '#2196f3', sourceIds: ['g-leo', 'g-shared-kids'] },
  { id: 'nobody', name: 'No Calendars', color: '#999999', sourceIds: [] },
];

describe('legend', () => {
  it('lists the people who own calendars', () => {
    const legend = buildLegend(people, []);
    expect(legend.mode).toBe('people');
    expect(legend.entries.map((x) => x.id)).toEqual(['mia', 'leo']);
  });

  it('falls back to one entry per calendar when nobody owns any', () => {
    const list = normalizeAll([e('a', 'cal-b', '#00ff00', 'Zed'), e('b', 'cal-a', '#0000ff', 'Alpha'), e('c', 'cal-a')], 'UTC');
    const legend = buildLegend([], list);
    expect(legend.mode).toBe('calendars');
    expect(legend.entries.map((x) => x.name)).toEqual(['Alpha', 'Zed']);
  });

  it('colors an event by its owner, else by its own calendar', () => {
    const list = normalizeAll([e('a', 'g-mia'), e('b', 'holidays', '#123456')], 'UTC');
    const legend = buildLegend(people, list);
    expect(colorOf(list[0], legend, '#000')).toBe('#e91e63');
    expect(colorOf(list[1], legend, '#000')).toBe('#123456');
  });

  it('supports a calendar shared by several people', () => {
    const list = normalizeAll([e('a', 'g-shared-kids')], 'UTC');
    const twoOwners: Person[] = [...people, { id: 'ava', name: 'Ava', color: '#4caf50', sourceIds: ['g-shared-kids'] }];
    expect(ownersOf(list[0], buildLegend(twoOwners, list)).map((o) => o.id)).toEqual(['leo', 'ava']);
  });
});

describe('filterEvents', () => {
  const list = normalizeAll([e('mia1', 'g-mia'), e('leo1', 'g-leo'), e('holiday', 'holidays')], 'UTC');
  const legend = buildLegend(people, list);

  it('shows everything with no selection', () => {
    expect(filterEvents(list, legend, new Set())).toHaveLength(3);
  });

  it('keeps the selected person plus shared events', () => {
    expect(filterEvents(list, legend, new Set(['mia'])).map((x) => x.id)).toEqual(['mia1', 'holiday']);
  });

  it('can hide shared events', () => {
    expect(filterEvents(list, legend, new Set(['mia']), false).map((x) => x.id)).toEqual(['mia1']);
  });
});

describe('people input', () => {
  it('ignores malformed entries', () => {
    expect(cleanPeople(undefined)).toEqual([]);
    expect(cleanPeople([null, 3, { id: 1 }, { id: 'a', name: 'A' }])).toEqual([
      { id: 'a', name: 'A', color: '#2f6fed', sourceIds: [] },
    ]);
  });

  it('makes initials', () => {
    expect(initials('Mia Lopez')).toBe('ML');
    expect(initials('leo')).toBe('L');
    expect(initials('  ')).toBe('?');
    expect(initials('Anna Maria Smith')).toBe('AS');
  });
});

describe('chores', () => {
  const payload = {
    date: '2026-11-02',
    members: [
      {
        id: 'm1',
        name: 'Mia',
        chores: [
          { id: 'c1', name: 'Make bed', points: 2, timeOfDay: 'morning', completed: true },
          { id: 'c2', name: 'Homework', points: 5, timeOfDay: 'afternoon', completed: false },
          { id: 'c3', name: 'Dishes', points: 3, timeOfDay: 'weird', completed: false },
          { id: 'c4', name: 'Feed cat', points: 1, completed: false },
        ],
      },
      { id: 'm2', name: 'Leo', chores: [] },
      { nope: true },
    ],
    bonus: [{ id: 'b1', name: 'Wash car', points: 10, kind: 'up-for-grabs', state: { status: 'open' } }],
  };

  it('reads the host answer defensively', () => {
    const data = parseChoresToday(payload)!;
    expect(data.date).toBe('2026-11-02');
    expect(data.members.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(data.bonus[0]).toMatchObject({ id: 'b1', state: 'open', points: 10 });
    expect(parseChoresToday(null)).toBeNull();
    expect(parseChoresToday({ members: 'x' })).toBeNull();
  });

  it('counts progress and points', () => {
    const [mia, leo] = parseChoresToday(payload)!.members;
    expect(progress(mia)).toEqual({ done: 1, total: 4, points: 11, earned: 2, complete: false });
    expect(progress(leo)).toMatchObject({ total: 0, complete: false });
  });

  it('groups by time of day with unknown labels as anytime', () => {
    const mia = parseChoresToday(payload)!.members[0];
    const groups = groupByTimeOfDay(mia.chores);
    expect(groups.map((g) => g.key)).toEqual(['morning', 'afternoon', 'anytime']);
    expect(groups[2].chores.map((c) => c.id)).toEqual(['c3', 'c4']);
  });

  it('applies a tick without touching anyone else', () => {
    const data = parseChoresToday(payload)!;
    const next = applyToggle(data, 'm1', 'c2', true);
    expect(next.members[0].chores[1].completed).toBe(true);
    expect(data.members[0].chores[1].completed).toBe(false);
    expect(progress(next.members[0]).done).toBe(2);
    expect(applyToggle(data, 'zzz', 'c2', true)).toEqual(data);
  });

  it('reads the family roster in either shape', () => {
    expect(parseFamily({ members: [{ id: 'm1', name: 'Mia', color: '#fff', emoji: '🦊' }, { x: 1 }] })).toEqual([
      { id: 'm1', name: 'Mia', color: '#fff', emoji: '🦊' },
    ]);
    expect(parseFamily([{ id: 'm1', name: 'Mia' }])[0].color).toBe('#2f6fed');
    expect(parseFamily('nope')).toEqual([]);
  });
});
