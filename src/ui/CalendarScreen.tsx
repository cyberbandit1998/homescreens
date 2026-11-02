import React from 'react';
import type { CalendarEvent, CalendarViewId, SourceStatus } from '../types';
import { S } from '../strings';
import { useHostFetch } from '../sdk';
import { addDays, type WeekStart, type Ymd } from '../lib/dates';
import { bucketByDay, normalizeAll } from '../lib/events';
import { fetchWindow, visibleRange } from '../lib/labels';
import { buildLegend, filterEvents, type Legend } from '../lib/people';
import type { Person } from '../types';
import { Icon, Skeleton, StateCard, type ViewCtx } from './common';
import { DayView } from './DayView';
import { MonthView } from './MonthView';
import { PeopleBar } from './PeopleBar';
import { ScheduleView } from './ScheduleView';
import { WeekView } from './WeekView';

interface CalendarPayload {
  events?: CalendarEvent[];
  sourceStatus?: SourceStatus[];
}

function readPayload(json: unknown): { events: CalendarEvent[]; status: SourceStatus[] } | null {
  if (Array.isArray(json)) return { events: json as CalendarEvent[], status: [] };
  if (json && typeof json === 'object') {
    const p = json as CalendarPayload;
    if (Array.isArray(p.events)) return { events: p.events, status: Array.isArray(p.sourceStatus) ? p.sourceStatus : [] };
  }
  return null;
}

/**
 * Fetches the events for the visible month (plus a month either side), then
 * draws the chosen view. Kept apart from the chores view so a household with
 * no calendar yet never asks the host for events it cannot give.
 */
export function CalendarScreen({ view, anchor, weekStart, tz, people, selected, onToggle, onClear, buildCtx }: {
  view: CalendarViewId;
  anchor: Ymd;
  weekStart: WeekStart;
  tz: string | undefined;
  people: Person[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  buildCtx: (legend: Legend) => ViewCtx;
}) {
  const win = fetchWindow(anchor);
  const url = `/api/calendar?timeMin=${encodeURIComponent(win.timeMin)}&timeMax=${encodeURIComponent(win.timeMax)}`;
  const [json, error] = useHostFetch<unknown>(url, 5 * 60_000);

  // Keep the last good answer through a failed refresh, along with the span it covers.
  const fresh = React.useMemo(() => readPayload(json), [json]);
  const kept = React.useRef<{ events: CalendarEvent[]; status: SourceStatus[]; from: Ymd; to: Ymd } | null>(null);
  if (fresh) kept.current = { ...fresh, from: win.from, to: win.to };

  const need = visibleRange(view, anchor, weekStart);
  const source = fresh
    ? { events: fresh.events, status: fresh.status }
    : kept.current && kept.current.from <= need.from && kept.current.to >= need.to
      ? kept.current
      : null;

  const normalized = React.useMemo(() => normalizeAll(source?.events, tz), [source?.events, tz]);
  const legend = React.useMemo(() => buildLegend(people, normalized), [people, normalized]);
  const visible = React.useMemo(() => filterEvents(normalized, legend, selected), [normalized, legend, selected]);
  const buckets = React.useMemo(
    () => bucketByDay(visible, addDays(win.from, -1), addDays(win.to, 1)),
    [visible, win.from, win.to],
  );

  if (!source) {
    return error ? (
      <div className="fwc-body">
        <StateCard icon={<Icon.Alert size="1.6em" />} title={S.schedule} body={S.loadFailed} />
      </div>
    ) : (
      <Skeleton />
    );
  }

  const ctx = buildCtx(legend);
  const failing = source.status.filter((s) => !s.ok);

  return (
    <>
      <PeopleBar legend={legend} selected={selected} onToggle={onToggle} onClear={onClear} surface={ctx.theme.surface} />
      {view === 'week' && <WeekView ctx={ctx} anchor={anchor} buckets={buckets} />}
      {view === 'day' && <DayView ctx={ctx} day={anchor} bucket={buckets.get(anchor)} />}
      {view === 'month' && <MonthView ctx={ctx} anchor={anchor} buckets={buckets} />}
      {view === 'schedule' && <ScheduleView ctx={ctx} anchor={anchor} buckets={buckets} />}
      {(failing.length > 0 || error) && (
        <p className="fwc-banner" role="status">
          <Icon.Alert size="1.1em" />
          {failing.length > 0
            ? S.sourcesFailing(failing.map((f) => f.name || f.id).join(', '))
            : S.loadFailed}
        </p>
      )}
    </>
  );
}
