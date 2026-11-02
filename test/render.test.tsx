import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FamilyWallCalendar from '../src/index';
import { FAMILY, PEOPLE, sampleChores, sampleEvents, TZ } from '../harness/fixtures';
import manifest from '../manifest.json';

// Draw the real component, server-side, with a stand-in for the host's SDK.
// This proves each view renders the right content from realistic data. It
// cannot prove layout (see the browser screenshots) or the real host.

const NOW = '2026-11-02T15:00:00.000Z'; // 9:00 am in Chicago, Monday
const TODAY = '2026-11-02';

const style = {
  fontSize: 16,
  fontFamily: 'inter',
  textColor: '#1c2430',
  backgroundColor: '#ffffff',
  borderRadius: 28,
  padding: 20,
  opacity: 1,
  backdropBlur: 0,
};

type Routes = Record<string, unknown>;

function installSdk(routes: Routes, failing = false) {
  const calls: string[] = [];
  const w = globalThis as unknown as { window: unknown; __HS_SDK__: unknown };
  w.window = globalThis;
  w.__HS_SDK__ = {
    locale: 'en-US',
    getHostSettings: () => ({ timezone: TZ }),
    useFetchData: (url: string) => {
      calls.push(url);
      if (failing) return [null, 'HTTP 500', null];
      const key = Object.keys(routes).find((k) => url.startsWith(k));
      return [key ? routes[key] : null, null, Date.now()];
    },
  };
  return calls;
}

function render(config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <FamilyWallCalendar
      config={{ ...manifest.defaultConfig, ...config }}
      style={style}
      timezone={TZ}
      people={PEOPLE}
      {...extra}
    />,
  );
}

const calendarRoute = () => ({ '/api/calendar': { events: sampleEvents(TODAY), sourceStatus: [] } });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => {
  vi.useRealTimers();
  const w = globalThis as unknown as { __HS_SDK__?: unknown };
  delete w.__HS_SDK__;
});

describe('Week view', () => {
  it('draws the week with today marked and events on the right days', () => {
    installSdk(calendarRoute());
    const html = render();
    // The range formatter puts thin spaces around the dash, so match any whitespace.
    expect(html).toMatch(/Nov 1\s–\s7, 2026/);
    expect(html).toContain('Soccer practice');
    expect(html).toContain('Picture day');
    expect(html).toContain('aria-current="date"');
    expect((html.match(/<section class="fwc-col"/g) ?? []).length).toBe(7);
  });

  it('can hide weekends', () => {
    installSdk(calendarRoute());
    const html = render({ showWeekends: false });
    expect((html.match(/<section class="fwc-col"/g) ?? []).length).toBe(5);
  });

  it('lists the family in the filter row', () => {
    installSdk(calendarRoute());
    const html = render();
    for (const name of ['Everyone', 'Mia', 'Leo', 'Sam', 'Alex']) expect(html).toContain(name);
  });

  it('puts an event on the household day, not the UTC day', () => {
    installSdk({
      '/api/calendar': {
        events: [{ id: 'late', title: 'Late show', start: '2026-11-03T03:00:00.000Z', end: '2026-11-03T04:00:00.000Z', allDay: false }],
      },
    });
    const html = render();
    // 03:00 UTC on Nov 3 is 9 pm on Nov 2 in Chicago: Monday's column, not Tuesday's.
    const monday = html.split('aria-label="Monday, November 2"')[1].split('</section>')[0];
    expect(monday).toContain('Late show');
  });
});

describe('other views', () => {
  it('Day view shows the timeline, all-day strip and times', () => {
    installSdk(calendarRoute());
    const html = render({ defaultView: 'day' });
    expect(html).toContain('Monday, November 2');
    expect(html).toContain('Picture day');
    expect(html).toContain('Dentist: Leo');
    expect(html).toContain('fwc-now'); // a "now" line, since the day is today
    expect(html).toContain('9 AM');
  });

  it('Month view draws the whole grid with a more-link when a day is crowded', () => {
    installSdk(calendarRoute());
    const html = render({ defaultView: 'month', maxEventsPerDay: 2 });
    expect(html).toContain('November 2026');
    // November 2026 on a Sunday-first grid is five full weeks.
    expect((html.match(/class="fwc-cell"/g) ?? []).length).toBe(35);
    expect(html).toMatch(/\+\d+ more/);
  });

  it('Schedule view groups by day with friendly names', () => {
    installSdk(calendarRoute());
    const html = render({ defaultView: 'schedule' });
    expect(html).toContain('Today');
    expect(html).toContain('Tomorrow');
    expect(html).toContain('Piano lesson');
    expect(html).toContain('Riverside Park');
  });

  it('honors a 24-hour clock', () => {
    installSdk(calendarRoute());
    const html = render({ defaultView: 'schedule' }, { timeFormat: '24h' });
    expect(html).toContain('15:30');
    expect(html).not.toContain('3:30 PM');
  });

  it('Monday-first weeks start on Monday', () => {
    installSdk(calendarRoute());
    const html = render({ startDay: 'monday' });
    expect(html).toMatch(/Nov 2\s–\s8, 2026/);
  });
});

describe('theme', () => {
  it('writes light variables on a white module and dark on a dark one', () => {
    installSdk(calendarRoute());
    const light = render();
    expect(light).toContain('--fwc-bg:rgb(255, 255, 255)');
    const dark = render({}, { style: { ...style, backgroundColor: 'rgba(0, 0, 0, 0.4)', textColor: '#ffffff' } });
    expect(dark).toContain('--fwc-bg:rgb(20, 24, 31)');
  });
});

describe('states', () => {
  it('shows a friendly setup card when no calendar is connected, and asks the host for nothing', () => {
    const calls = installSdk({});
    const html = render({}, { calendarSetup: 'noSources' });
    expect(html).toContain('Connect a calendar');
    expect(calls.filter((c) => c.startsWith('/api/calendar'))).toEqual([]);
  });

  it('shows loading, not an empty week, before the first answer', () => {
    installSdk({});
    const html = render();
    expect(html).toContain('fwc-skel');
    expect(html).not.toContain('Nothing planned');
  });

  it('says so plainly when the calendar cannot be reached', () => {
    installSdk({}, true);
    expect(render()).toContain("Can&#x27;t reach your calendar");
  });

  it('flags calendars that are not updating without using color alone', () => {
    installSdk({
      '/api/calendar': {
        events: sampleEvents(TODAY),
        sourceStatus: [{ id: 'g-mia', name: "Mia's calendar", ok: false, error: 'x' }],
      },
    });
    expect(render()).toContain("Not updating: Mia&#x27;s calendar");
  });

  it('never prints a raw calendar id when the hub names a failing calendar only by its hash', () => {
    const hash = '1d1a1e606c47d4ff13e908f50a530fdef2d205021d6d27c94c67d50b54263362';
    // The hub names no calendar; no event carries that id, so nothing can be looked up.
    installSdk({ '/api/calendar': { events: sampleEvents(TODAY), sourceStatus: [{ id: hash, ok: false, error: 'Could not reach the link' }] } });
    const html = render();
    expect(html).not.toContain(hash);
    expect(html).toContain("A calendar isn&#x27;t updating");
    expect(html).toContain('Could not reach the link');
  });

  it('finds the failing calendar’s name from the events it supplied', () => {
    installSdk({ '/api/calendar': { events: sampleEvents(TODAY), sourceStatus: [{ id: 'g-mia', ok: false }] } });
    expect(render()).toContain("Not updating: Mia&#x27;s calendar");
  });

  it('asks the host for a window around the visible month, not just the next week', () => {
    const calls = installSdk(calendarRoute());
    render({ defaultView: 'month' });
    const url = decodeURIComponent(calls.find((c) => c.startsWith('/api/calendar'))!);
    expect(url).toContain('timeMin=2026-09-');
    expect(url).toContain('timeMax=2027-01-');
  });

  it('survives hostile config', () => {
    installSdk(calendarRoute());
    expect(() => render({ defaultView: 7, theme: {}, maxEventsPerDay: 'lots', startDay: null, accentColor: 5 })).not.toThrow();
    expect(() => render({}, { people: 'nope', timezone: 'Not/AZone' })).not.toThrow();
  });
});

describe('Chores view', () => {
  const choreRoutes = (done: 'some' | 'all' | 'none' = 'some') => ({
    ...calendarRoute(),
    '/api/chores/today': { ...sampleChores(done), date: TODAY },
    '/api/family': FAMILY,
  });

  it('offers a Chores tab, and hides it when switched off', () => {
    installSdk(choreRoutes());
    expect(render()).toContain('>Chores<');
    expect(render({ showChores: false })).not.toContain('>Chores<');
  });

  it('shows a card per person with progress and tickable rows', async () => {
    installSdk(choreRoutes());
    const { ChoresView } = await import('../src/ui/ChoresView');
    const ctx = {
      today: TODAY,
      theme: { surface: [255, 255, 255] },
    } as unknown as Parameters<typeof ChoresView>[0]['ctx'];
    const html = renderToStaticMarkup(<ChoresView ctx={ctx} tappable />);
    expect(html).toContain('Mia');
    expect(html).toContain('2 of 4 done');
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Mark &quot;Practice violin&quot; as done');
    expect(html).toContain('Morning');
    expect(html).toContain('Bonus chores');
    expect(html).toContain('Nothing to do today'); // Alex has none
  });

  it('celebrates when someone finishes everything and can be read-only', async () => {
    installSdk(choreRoutes('all'));
    const { ChoresView } = await import('../src/ui/ChoresView');
    const ctx = { today: TODAY, theme: { surface: [255, 255, 255] } } as unknown as Parameters<typeof ChoresView>[0]['ctx'];
    const html = renderToStaticMarkup(<ChoresView ctx={ctx} tappable={false} />);
    expect(html).toContain('All done!');
    expect(html).not.toContain('<button type="button" role="checkbox"');
    expect(html).toContain('aria-readonly="true"');
  });

  it('shows an empty state when there are no chores', async () => {
    installSdk({ '/api/chores/today': { date: TODAY, members: [{ id: 'mia', name: 'Mia', chores: [] }], bonus: [] }, '/api/family': FAMILY });
    const { ChoresView } = await import('../src/ui/ChoresView');
    const ctx = { today: TODAY, theme: { surface: [255, 255, 255] } } as unknown as Parameters<typeof ChoresView>[0]['ctx'];
    expect(renderToStaticMarkup(<ChoresView ctx={ctx} tappable />)).toContain('No chores today');
  });
});

describe('manifest', () => {
  it('has what the host requires and only valid widget names', () => {
    for (const field of ['id', 'name', 'version', 'moduleType', 'category']) {
      expect(typeof (manifest as Record<string, unknown>)[field]).toBe('string');
    }
    expect(manifest.id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(manifest.moduleType).toBe(manifest.id);
    const widgets = new Set(['text', 'textarea', 'number', 'slider', 'toggle', 'select', 'multiselect', 'color', 'time']);
    const props = manifest.configSchema.properties as Record<string, Record<string, unknown>>;
    for (const [key, schema] of Object.entries(props)) {
      expect(widgets.has(schema['ui:widget'] as string), key).toBe(true);
      expect(key in manifest.defaultConfig, `${key} has a default`).toBe(true);
    }
    for (const key of Object.keys(manifest.defaultConfig)) {
      expect(key in props, `${key} is editable`).toBe(true);
    }
  });

  it('asks only for what it uses', () => {
    expect(manifest.dataRequirements).toEqual(['calendar']);
    expect((manifest as Record<string, unknown>).allowedDomains).toBeUndefined();
    expect((manifest as Record<string, unknown>).secrets).toBeUndefined();
  });
});
