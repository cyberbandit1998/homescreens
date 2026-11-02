// Synthetic household used by the render tests and the screenshot harness.
// Nothing here is real data. Dates are built relative to "today" so the
// calendar always looks lived-in.

import type { CalendarEvent, Person } from '../src/types';
import { addDays } from '../src/lib/dates';

export const TZ = 'America/Chicago';
/** Offset used for fixture timestamps (Nov, central standard time). */
const OFFSET = '-06:00';

export const PEOPLE: Person[] = [
  { id: 'mia', name: 'Mia', color: '#e8509a', sourceIds: ['g-mia'] },
  { id: 'leo', name: 'Leo', color: '#2f8fe8', sourceIds: ['g-leo'] },
  { id: 'sam', name: 'Sam', color: '#2fa36b', sourceIds: ['g-sam'] },
  { id: 'alex', name: 'Alex', color: '#f08a24', sourceIds: ['g-alex'] },
];

let n = 0;
function timed(today: string, day: number, from: string, to: string, title: string, sourceId: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const ymd = addDays(today, day);
  const endDay = to < from ? addDays(ymd, 1) : ymd;
  const person = PEOPLE.find((p) => p.sourceIds.includes(sourceId));
  return {
    id: `fx-${++n}`,
    title,
    start: `${ymd}T${from}:00${OFFSET}`,
    end: `${endDay}T${to}:00${OFFSET}`,
    allDay: false,
    sourceId,
    sourceName: person ? `${person.name}'s calendar` : 'Family',
    calendarColor: person?.color ?? '#14a0a0',
    ...extra,
  };
}

function allDay(today: string, day: number, days: number, title: string, sourceId: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const person = PEOPLE.find((p) => p.sourceIds.includes(sourceId));
  return {
    id: `fx-${++n}`,
    title,
    start: addDays(today, day),
    end: addDays(today, day + days),
    allDay: true,
    sourceId,
    sourceName: person ? `${person.name}'s calendar` : 'Family',
    calendarColor: person?.color ?? '#14a0a0',
    ...extra,
  };
}

export function sampleEvents(today: string): CalendarEvent[] {
  n = 0;
  return [
    timed(today, -2, '16:00', '17:00', 'Art club', 'g-mia'),
    timed(today, -1, '18:00', '19:00', 'Swim practice', 'g-leo'),
    allDay(today, 0, 1, 'Picture day', 'g-mia'),
    timed(today, 0, '07:30', '08:15', 'School drop-off', 'g-sam'),
    timed(today, 0, '09:00', '10:00', 'Dentist: Leo', 'g-leo', { location: 'Smile Pediatric Dentistry, 214 Oak Street', description: 'Bring the insurance card.<br>Appointment is a 6 month check-up &amp; cleaning.' }),
    timed(today, 0, '15:30', '16:30', 'Soccer practice', 'g-mia', { location: 'Riverside Park, Field 3' }),
    timed(today, 0, '16:00', '16:45', 'Piano lesson', 'g-leo'),
    timed(today, 0, '18:30', '20:00', "Dinner at Grandma's", 'g-family'),
    allDay(today, 1, 4, 'Grandparents visiting', 'g-family'),
    timed(today, 1, '16:00', '17:00', 'Orthodontist', 'g-mia', { location: 'Bright Smiles Orthodontics' }),
    timed(today, 1, '19:00', '20:30', 'Parent-teacher night', 'g-alex'),
    timed(today, 2, '12:00', '13:00', 'Lunch with Aunt Rae', 'g-alex'),
    timed(today, 2, '17:30', '19:00', 'Swim practice', 'g-leo'),
    timed(today, 2, '17:45', '18:30', 'Book club', 'g-alex'),
    timed(today, 3, '08:00', '17:00', 'Sam: work conference', 'g-sam'),
    timed(today, 3, '15:30', '16:30', 'Soccer practice', 'g-mia'),
    timed(today, 4, '22:00', '06:00', 'Sleepover at Jake’s', 'g-leo'),
    timed(today, 4, '10:00', '11:30', 'Farmers market', 'g-family'),
    allDay(today, 5, 1, "Grandpa Joe's birthday", 'g-family', { kind: 'birthday' }),
    timed(today, 5, '14:00', '15:00', 'Haircuts', 'g-alex'),
    timed(today, 6, '07:00', '07:30', 'Trash & recycling out', 'g-sam'),
    timed(today, 7, '09:30', '10:30', 'Vet: Biscuit shots', 'g-alex'),
    timed(today, 8, '13:00', '16:00', 'Birthday party: Ava', 'g-mia', { location: 'Jump Zone' }),
    allDay(today, 9, 1, 'Veterans Day', 'holidays', { kind: 'holiday', calendarColor: '#7a8699' }),
    timed(today, 10, '18:00', '19:00', 'Swim meet', 'g-leo'),
    timed(today, 12, '19:00', '21:00', 'Date night', 'g-sam'),
    allDay(today, 13, 3, 'Camping trip', 'g-family'),
  ];
}

export function sampleChores(done: 'some' | 'all' | 'none' = 'some') {
  const tick = (v: boolean) => (done === 'all' ? true : done === 'none' ? false : v);
  return {
    date: '',
    members: [
      {
        id: 'mia',
        name: 'Mia',
        chores: [
          { id: 'c1', name: 'Make bed', points: 2, timeOfDay: 'morning', completed: tick(true) },
          { id: 'c2', name: 'Brush teeth', points: 1, timeOfDay: 'morning', completed: tick(true) },
          { id: 'c3', name: 'Practice violin', points: 5, timeOfDay: 'afternoon', completed: tick(false) },
          { id: 'c4', name: 'Set the table', points: 3, timeOfDay: 'evening', completed: tick(false) },
        ],
      },
      {
        id: 'leo',
        name: 'Leo',
        chores: [
          { id: 'c5', name: 'Feed Biscuit', points: 2, timeOfDay: 'morning', completed: tick(true) },
          { id: 'c6', name: 'Homework', points: 5, timeOfDay: 'afternoon', completed: tick(false) },
          { id: 'c7', name: 'Clear the dishes', points: 3, timeOfDay: 'evening', completed: tick(false) },
        ],
      },
      {
        id: 'sam',
        name: 'Sam',
        chores: [
          { id: 'c8', name: 'Take out the trash', points: 0, timeOfDay: 'anytime', completed: tick(false) },
        ],
      },
      { id: 'alex', name: 'Alex', chores: [] },
    ],
    bonus: [
      { id: 'b1', name: 'Wash the car', points: 10, kind: 'up-for-grabs', state: { status: 'open' } },
    ],
  };
}

export const FAMILY = {
  members: [
    { id: 'mia', name: 'Mia', color: '#e8509a', emoji: '' },
    { id: 'leo', name: 'Leo', color: '#2f8fe8', emoji: '' },
    { id: 'sam', name: 'Sam', color: '#2fa36b', emoji: '' },
    { id: 'alex', name: 'Alex', color: '#f08a24', emoji: '' },
  ],
  groups: [],
};
