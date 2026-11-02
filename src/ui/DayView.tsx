import React from 'react';
import { formatHour, type Ymd } from '../lib/dates';
import { layoutTimeline, type DayBucket } from '../lib/events';
import { EventCard, type ViewCtx } from './common';

/** Height of one hour, in em, so the whole timeline follows the Text size. */
export const HOUR_EM = 4.6;

/** One day on an hour-by-hour timeline, with an all-day strip above it. */
export function DayView({ ctx, day, bucket }: {
  ctx: ViewCtx;
  day: Ymd;
  bucket: DayBucket | undefined;
}) {
  const allDay = bucket?.allDay ?? [];
  const placed = React.useMemo(() => layoutTimeline(bucket?.timed ?? [], day), [bucket, day]);

  // Show the configured hours, widened to fit any event outside them.
  let first = ctx.cfg.dayStartHour;
  let last = ctx.cfg.dayEndHour;
  for (const p of placed) {
    first = Math.min(first, Math.floor(p.startMin / 60));
    last = Math.max(last, Math.ceil(p.endMin / 60));
  }
  const hours = Math.max(1, last - first);
  const base = first * 60;
  const scroller = React.useRef<HTMLDivElement>(null);

  // Open near "now" today, or near the first event on other days.
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const focusMin = day === ctx.today ? ctx.nowMin - 60 : placed.length ? placed[0].startMin - 30 : base;
    const fontPx = parseFloat(getComputedStyle(el).fontSize) || 16;
    el.scrollTop = Math.max(0, ((focusMin - base) / 60) * HOUR_EM * fontPx);
    // Only when the day or the visible hours change, never on every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, base]);

  const showNow = day === ctx.today && ctx.nowMin >= base && ctx.nowMin < last * 60;

  return (
    <div className="fwc-body" style={{ display: 'flex', flexDirection: 'column' }}>
      {allDay.length > 0 && (
        <div className="fwc-allday">
          {allDay.map((e) => (
            <EventCard key={e.id} e={e} day={day} ctx={ctx} />
          ))}
        </div>
      )}
      <div ref={scroller} className="fwc-scroll" style={{ flex: '1 1 auto', minHeight: 0 }}>
        <div className="fwc-tl" style={{ height: `${hours * HOUR_EM}em` }}>
          <div className="fwc-hours" aria-hidden="true">
            {Array.from({ length: hours }, (_, i) => (
              // The wrapper is positioned (so `em` means the module's font size);
              // the smaller type lives on the inner span. Positioning an element
              // that has its own smaller font-size would shrink every offset.
              <div
                key={i}
                className="fwc-hour"
                data-first={i === 0 || undefined}
                style={{ top: `${i * HOUR_EM}em` }}
              >
                <span>{formatHour(first + i, ctx.locale, ctx.hour12)}</span>
              </div>
            ))}
          </div>
          <div className="fwc-grid">
            {Array.from({ length: hours }, (_, i) => (
              <div key={i} className="fwc-line" style={{ top: `${i * HOUR_EM}em` }} aria-hidden="true" />
            ))}
            {placed.map((p) => (
              <div
                key={p.event.id}
                className="fwc-slot"
                style={{
                  top: `${((p.startMin - base) / 60) * HOUR_EM}em`,
                  height: `${((p.endMin - p.startMin) / 60) * HOUR_EM}em`,
                  left: `${(p.col / p.cols) * 100}%`,
                  width: `${100 / p.cols}%`,
                }}
              >
                <EventCard e={p.event} day={day} ctx={ctx} compact={(ctx.width - 64) / p.cols < 300} />
              </div>
            ))}
            {showNow && (
              <div
                className="fwc-now"
                style={{ top: `${((ctx.nowMin - base) / 60) * HOUR_EM}em` }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
