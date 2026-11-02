import React from 'react';
import { S } from '../strings';
import { addDays, formatClock, formatDay, type Ymd } from '../lib/dates';
import type { NormEvent } from '../lib/events';
import { eventTimeLabel, plainText } from '../lib/labels';
import { Avatar, Icon, lookVars, type ViewCtx } from './common';

function whenLabel(e: NormEvent, day: Ymd, ctx: ViewCtx): { date: string; time: string } {
  const long = { weekday: 'long', month: 'long', day: 'numeric' } as const;
  const short = { month: 'short', day: 'numeric' } as const;
  if (e.allDay) {
    const last = addDays(e.endYmd, -1);
    const date = last > e.startYmd
      ? `${formatDay(e.startYmd, ctx.locale, short)} – ${formatDay(last, ctx.locale, short)}`
      : formatDay(e.startYmd, ctx.locale, long);
    return { date, time: S.allDay };
  }
  const fmt = (m: number) => formatClock(m, ctx.locale, ctx.hour12);
  if (e.startYmd !== e.endYmd && !(e.endMin === 0 && addDays(e.startYmd, 1) === e.endYmd)) {
    return {
      date: formatDay(e.startYmd, ctx.locale, long),
      time: `${fmt(e.startMin)} → ${formatDay(e.endYmd, ctx.locale, short)}, ${fmt(e.endMin)}`,
    };
  }
  return { date: formatDay(day, ctx.locale, long), time: eventTimeLabel(e, e.startYmd, ctx) };
}

/** A bottom sheet with everything about one event. Tap outside or press Escape to close. */
export function EventSheet({ e, day, ctx, onClose }: {
  e: NormEvent;
  day: Ymd;
  ctx: ViewCtx;
  onClose: () => void;
}) {
  const look = ctx.look(e);
  const owners = ctx.owners(e);
  const when = whenLabel(e, day, ctx);
  const notes = plainText(e.raw.description);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Move focus into the sheet, and give it back to the event that opened it.
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const kind = e.raw.kind === 'birthday' ? S.birthday : e.raw.kind === 'holiday' ? S.holiday : '';

  return (
    <div className="fwc-scrim" onClick={onClose}>
      <div
        className="fwc-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={e.title}
        style={lookVars(look)}
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="fwc-sheet-bar" style={{ ['--bar' as string]: look.bar } as React.CSSProperties} />
        <div className="fwc-sheet-top">
          <h2 className="fwc-sheet-title">{e.title}</h2>
          <button ref={closeRef} type="button" className="fwc-round" onClick={onClose} aria-label={S.close}>
            <Icon.Close />
          </button>
        </div>
        <p className="fwc-sheet-when">
          {when.date} · {when.time}
          {kind ? ` · ${kind}` : ''}
        </p>
        {owners.length > 0 && (
          <div className="fwc-sheet-row">
            <span className="fwc-sheet-label">{S.who}</span>
            <div className="fwc-sheet-val fwc-who">
              {owners.map((o) => (
                <span key={o.id}>
                  <Avatar name={o.name} color={o.color} surface={ctx.theme.surface} small />
                  {o.name}
                </span>
              ))}
            </div>
          </div>
        )}
        {e.raw.location && (
          <div className="fwc-sheet-row">
            <span className="fwc-sheet-label">{S.where}</span>
            <span className="fwc-sheet-val">{e.raw.location}</span>
          </div>
        )}
        {notes && (
          <div className="fwc-sheet-row">
            <span className="fwc-sheet-label">{S.notes}</span>
            <span className="fwc-sheet-val">{notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
