import React from 'react';
import { S } from '../strings';
import { addDays, formatClock, type Ymd } from '../lib/dates';
import type { DayBucket } from '../lib/events';
import { dayHeading } from '../lib/labels';
import { EventCard, StateCard, Icon, type ViewCtx } from './common';

const DAYS = 14;

/** A scrolling list of the next two weeks, grouped by day. */
export function ScheduleView({ ctx, anchor, buckets }: {
  ctx: ViewCtx;
  anchor: Ymd;
  buckets: Map<Ymd, DayBucket>;
}) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(anchor, i));
  const withEvents = days.filter((d) => {
    const b = buckets.get(d);
    return b && b.allDay.length + b.timed.length > 0;
  });
  // Always show the first day, even if empty, so the list never starts blank.
  const visible = days.filter((d, i) => i === 0 || withEvents.includes(d));
  const narrow = ctx.width < 640;

  if (withEvents.length === 0) {
    return (
      <div className="fwc-body">
        <StateCard icon={<Icon.Calendar size="1.6em" />} title={S.nothingPlanned} body={S.freeDay} />
      </div>
    );
  }

  return (
    <div className="fwc-body fwc-scroll">
      <div className="fwc-sched" data-narrow={narrow || undefined}>
        {visible.map((day) => {
          const bucket = buckets.get(day);
          const head = dayHeading(day, ctx.today, ctx.locale);
          const rows = bucket ? [...bucket.allDay, ...bucket.timed] : [];
          return (
            <section key={day} className="fwc-sday" aria-label={head.date}>
              <div className="fwc-sdate" data-today={day === ctx.today || undefined}>
                <div className="fwc-srel">{head.relative ?? head.date}</div>
                {head.relative && <div className="fwc-sd">{head.date}</div>}
              </div>
              <div className="fwc-slist">
                {rows.length === 0 ? (
                  <p className="fwc-snone">{S.nothingPlanned}</p>
                ) : (
                  rows.map((e) => (
                    <div key={e.id} className="fwc-srow">
                      <span className="fwc-stime">
                        {e.allDay ? S.allDay : e.startYmd === day ? formatClock(e.startMin, ctx.locale, ctx.hour12, true) : S.continues}
                      </span>
                      <EventCard e={e} day={day} ctx={ctx} hideTime showWhere />
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
