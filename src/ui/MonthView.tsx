import React from 'react';
import { S } from '../strings';
import { formatClock, formatDay, monthGrid, sameMonth, type Ymd } from '../lib/dates';
import type { DayBucket, NormEvent } from '../lib/events';
import { lookVars, type ViewCtx } from './common';

/** The classic wall-calendar grid: a tile per day, events as small colored bars. */
export function MonthView({ ctx, anchor, buckets }: {
  ctx: ViewCtx;
  anchor: Ymd;
  buckets: Map<Ymd, DayBucket>;
}) {
  const rows = monthGrid(anchor, ctx.weekStart);
  const dense = ctx.width < 760;

  // How many event bars fit in a tile: tile height in em, minus the day number.
  // Each bar is a touch-sized 2.1em at .76em type, about 1.75em of the module's size.
  const bodyEm = ctx.height / ctx.fontPx - 10;
  const tileEm = bodyEm / rows.length;
  const fits = Math.max(1, Math.floor((tileEm - 2.3) / 1.75));
  const max = Math.max(1, Math.min(ctx.cfg.maxEventsPerDay, fits));

  return (
    <div className="fwc-month">
      <div className="fwc-mhead" aria-hidden="true">
        {rows[0].map((d) => (
          <span key={d} className="fwc-mdow">
            {formatDay(d, ctx.locale, { weekday: 'short' })}
          </span>
        ))}
      </div>
      <div className="fwc-mgrid">
        {rows.flat().map((day) => {
          const bucket = buckets.get(day);
          const events: NormEvent[] = bucket ? [...bucket.allDay, ...bucket.timed] : [];
          const overflow = events.length > max;
          const shown = overflow ? events.slice(0, max - 1) : events;
          const hidden = events.length - shown.length;
          const label = formatDay(day, ctx.locale, { weekday: 'long', month: 'long', day: 'numeric' });
          return (
            <div
              key={day}
              className="fwc-cell"
              data-today={day === ctx.today || undefined}
              data-out={!sameMonth(day, anchor) || undefined}
            >
              <button
                type="button"
                className="fwc-hit"
                onClick={() => ctx.openDay(day)}
                aria-label={`${label}${events.length ? `, ${events.length}` : ''}`}
              />
              <span className="fwc-cnum" aria-hidden="true">
                {formatDay(day, ctx.locale, { day: 'numeric' })}
              </span>
              {dense ? (
                events.length > 0 && (
                  <span className="fwc-dots" aria-hidden="true">
                    {events.slice(0, 6).map((e) => (
                      <span key={e.id} className="fwc-dot" style={{ ['--bar' as string]: ctx.look(e).bar } as React.CSSProperties} />
                    ))}
                  </span>
                )
              ) : (
                <>
                  {shown.map((e) => {
                    const timeBit = e.allDay || e.startYmd !== day ? '' : `${formatClock(e.startMin, ctx.locale, ctx.hour12, true)} `;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className="fwc-mev"
                        data-allday={e.allDay || undefined}
                        style={lookVars(ctx.look(e))}
                        onClick={() => ctx.open(e, day)}
                        aria-label={`${e.title}, ${label}`}
                      >
                        {timeBit}
                        {e.title}
                      </button>
                    );
                  })}
                  {hidden > 0 && (
                    <button type="button" className="fwc-more" onClick={() => ctx.openDay(day)}>
                      {S.moreEvents(hidden)}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
