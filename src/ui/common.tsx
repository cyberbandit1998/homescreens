import React from 'react';
import type { PluginConfig } from '../types';
import type { Ymd, WeekStart } from '../lib/dates';
import type { NormEvent } from '../lib/events';
import type { LegendEntry, Legend } from '../lib/people';
import type { Theme } from '../lib/theme';
import { ensureContrast, readableOn, toRgb, css, type RGB } from '../lib/colors';
import { initials } from '../lib/people';
import { eventTimeLabel } from '../lib/labels';
import { isOver, isRunning } from '../lib/events';

// ── Shared context handed to every view ──────────────────────────────────────

export interface EventLook {
  bg: string;
  fg: string;
  bar: string;
  sub: string;
  /** Text color on a solid `bar` fill (all-day events). */
  on: string;
}

export interface ViewCtx {
  today: Ymd;
  nowMin: number;
  locale: string;
  hour12: boolean;
  cfg: PluginConfig;
  weekStart: WeekStart;
  legend: Legend;
  theme: Theme;
  width: number;
  height: number;
  /** The module's font size in px, to turn pixel measurements into em. */
  fontPx: number;
  look: (e: NormEvent) => EventLook;
  owners: (e: NormEvent) => LegendEntry[];
  open: (e: NormEvent, day: Ymd) => void;
  openDay: (day: Ymd) => void;
}

// ── Icons (inline SVG: no emoji font needed on a Raspberry Pi) ───────────────

interface IconProps {
  size?: string;
}

function svg(path: React.ReactNode, { size = '1.25em' }: IconProps, strokeWidth = 2.4) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}

export const Icon = {
  Left: (p: IconProps) => svg(<polyline points="15 5 8 12 15 19" />, p),
  Right: (p: IconProps) => svg(<polyline points="9 5 16 12 9 19" />, p),
  Check: (p: IconProps) => svg(<polyline points="5 12.5 10 17.5 19 7" />, p, 3),
  Close: (p: IconProps) => svg(<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>, p),
  Star: (p: IconProps) =>
    svg(<polygon points="12 3 14.8 9 21.3 9.7 16.4 14.1 17.8 20.5 12 17.2 6.2 20.5 7.6 14.1 2.7 9.7 9.2 9 12 3" fill="currentColor" />, p, 1.5),
  Pin: (p: IconProps) => svg(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>, p, 2),
  Alert: (p: IconProps) => svg(<><path d="M12 3.5 2.8 19.5h18.4z" /><line x1="12" y1="10" x2="12" y2="14.2" /><line x1="12" y1="17" x2="12" y2="17.1" /></>, p, 2),
  Calendar: (p: IconProps) =>
    svg(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><line x1="3.5" y1="10" x2="20.5" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></>, p, 2),
  Clipboard: (p: IconProps) =>
    svg(<><rect x="5" y="4.5" width="14" height="16" rx="3" /><rect x="9" y="2.8" width="6" height="3.4" rx="1.4" /><polyline points="8.8 13 11 15.2 15.4 10.8" /></>, p, 2),
};

// ── Avatar ───────────────────────────────────────────────────────────────────

export function chipVars(color: string, surface: RGB): React.CSSProperties {
  const base = toRgb(color, [47, 111, 237]);
  return {
    ['--chip' as string]: css(base),
    ['--chip-fg' as string]: css(readableOn(base)),
    // A ring/outline needs 3:1 against what it sits on (WCAG 1.4.11).
    ['--ring' as string]: css(ensureContrast(base, surface, 3)),
  };
}

export function Avatar({ name, color, emoji, surface, small }: {
  name: string;
  color: string;
  emoji?: string;
  surface: RGB;
  small?: boolean;
}) {
  return (
    <span className={small ? 'fwc-avatar fwc-avatar-sm' : 'fwc-avatar'} style={chipVars(color, surface)} aria-hidden="true">
      {emoji || initials(name)}
    </span>
  );
}

// ── Event card ───────────────────────────────────────────────────────────────

export function lookVars(look: EventLook): React.CSSProperties {
  return {
    ['--ev-bg' as string]: look.bg,
    ['--ev-fg' as string]: look.fg,
    ['--ev-bar' as string]: look.bar,
    ['--ev-sub' as string]: look.sub,
    ['--ev-on' as string]: look.on,
  };
}

export function EventCard({ e, day, ctx, showWho = true, hideTime = false, showWhere = false, compact }: {
  e: NormEvent;
  day: Ymd;
  ctx: ViewCtx;
  showWho?: boolean;
  /** The row already shows the time (Schedule view). */
  hideTime?: boolean;
  showWhere?: boolean;
  /** Short times ("3:30p") for narrow cards. Defaults to a guess from the module width. */
  compact?: boolean;
}) {
  const look = ctx.look(e);
  const time = hideTime ? '' : eventTimeLabel(e, day, ctx, compact ?? ctx.width < 900);
  const owners = showWho ? ctx.owners(e) : [];
  const who = owners.map((o) => o.name).join(', ');
  const where = showWhere ? e.raw.location ?? '' : '';
  const sub = [time, who, where].filter(Boolean).join(' · ');
  const past = isOver(e, day, ctx.nowMin, ctx.today);
  const now = day === ctx.today && isRunning(e, day, ctx.nowMin);
  return (
    <button
      type="button"
      className="fwc-ev"
      style={lookVars(look)}
      data-past={past || undefined}
      data-allday={e.allDay || undefined}
      data-now={now || undefined}
      onClick={() => ctx.open(e, day)}
      aria-label={`${e.title}, ${sub}`}
    >
      <span className="fwc-ev-t">{e.title}</span>
      <span className="fwc-ev-s">{sub}</span>
    </button>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

export function StateCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="fwc-state" role="status">
      <span className="fwc-state-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="fwc-body" aria-hidden="true" style={{ display: 'grid', gap: '.6em', alignContent: 'start' }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="fwc-skel" style={{ height: `${3.2 - (i % 3) * 0.5}em`, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}
