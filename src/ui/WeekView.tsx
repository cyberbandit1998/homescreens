import React from 'react';
import { S } from '../strings';
import { addDays, formatDay, startOfWeek, weekday, type Ymd } from '../lib/dates';
import type { DayBucket } from '../lib/events';
import { EventCard, type ViewCtx } from './common';

/** Seven tall columns, one per day, each a stack of soft event cards. */
export function WeekView({ ctx, anchor, buckets }: {
  ctx: ViewCtx;
  anchor: Ymd;
  buckets: Map<Ymd, DayBucket>;
}) {
  const start = startOfWeek(anchor, ctx.weekStart);
  let days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  if (!ctx.cfg.showWeekends) days = days.filter((d) => weekday(d) !== 0 && weekday(d) !== 6);
  // Narrow modules (a portrait phone-sized box) stack the days instead.
  const stack = ctx.width < 760;
  // A column narrower than ~215px cannot fit "3:30 PM – 4:30 PM", so use short times.
  const compact = (stack ? ctx.width : ctx.width / days.length) < 215;

  return (
    <div className="fwc-body fwc-scroll">
      <div
        className="fwc-week"
        data-stack={stack || undefined}
        style={{ ['--cols' as string]: days.length } as React.CSSProperties}
      >
        {days.map((day) => {
          const bucket = buckets.get(day);
          const events = bucket ? [...bucket.allDay, ...bucket.timed] : [];
          const isToday = day === ctx.today;
          return (
            <section
              key={day}
              className="fwc-col"
              data-today={isToday || undefined}
              aria-label={formatDay(day, ctx.locale, { weekday: 'long', month: 'long', day: 'numeric' })}
            >
              <div className="fwc-colhead" data-row={stack || undefined}>
                <span className="fwc-dow">{formatDay(day, ctx.locale, { weekday: 'short' })}</span>
                <span className="fwc-dnum" aria-current={isToday ? 'date' : undefined}>
                  {formatDay(day, ctx.locale, { day: 'numeric' })}
                </span>
              </div>
              {events.length === 0 ? (
                <p className="fwc-empty-col">{stack ? S.nothingPlanned : '—'}</p>
              ) : (
                events.map((e) => <EventCard key={`${e.id}@${day}`} e={e} day={day} ctx={ctx} compact={compact} />)
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
