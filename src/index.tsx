import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';
import { readConfig, type ViewId } from './types';
import { S } from './strings';
import { hostLocale, hostTimezone } from './sdk';
import { useNow, useSize } from './hooks/hooks';
import { formatDay, sameMonth, startOfWeek, wallParts, wantsHour12, type Ymd } from './lib/dates';
import { css, pillFor, readableOn, toRgb } from './lib/colors';
import { rangeLabel, stepAnchor } from './lib/labels';
import { cleanPeople, colorOf, ownersOf, type Legend } from './lib/people';
import { resolveTheme } from './lib/theme';
import type { NormEvent } from './lib/events';
import { CalendarScreen } from './ui/CalendarScreen';
import { ChoresView } from './ui/ChoresView';
import { Icon, StateCard, type EventLook, type ViewCtx } from './ui/common';
import { EventSheet } from './ui/EventSheet';
import { Header } from './ui/Header';
import { CSS } from './ui/styles';

/** Props the host adds when the manifest asks for `dataRequirements: ["calendar"]`. */
type Props = PluginComponentProps & {
  people?: unknown;
  calendarSetup?: string;
  timeFormat?: string;
};

interface OpenEvent {
  e: NormEvent;
  day: Ymd;
  /** The legend the tapped view was drawn with, so the sheet names the same people. */
  legend: Legend;
}

const EMPTY_LEGEND: Legend = { mode: 'calendars', entries: [] };

/** Whether the visible range already holds today (the Today button then rests). */
function showsToday(view: Exclude<ViewId, 'chores'>, anchor: Ymd, today: Ymd, weekStart: 0 | 1): boolean {
  switch (view) {
    case 'week':
      return startOfWeek(anchor, weekStart) === startOfWeek(today, weekStart);
    case 'month':
      return sameMonth(anchor, today);
    default:
      return anchor === today;
  }
}

/** Used only if a host ever omits `style`; the real host always passes it. */
const FALLBACK_STYLE: Props['style'] = {
  fontSize: 16,
  fontFamily: '',
  textColor: '#1c2430',
  backgroundColor: '#ffffff',
  borderRadius: 28,
  padding: 20,
  opacity: 1,
  backdropBlur: 0,
};

export default function FamilyWallCalendar(rawProps: Props) {
  const props = rawProps.style ? rawProps : { ...rawProps, style: FALLBACK_STYLE };
  const cfg = readConfig(props.config);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const size = useSize(rootRef);
  // Until the first measurement, assume a roomy module so views do not flash narrow.
  const width = size.w || 1000;
  const height = size.h || 700;

  const locale = hostLocale();
  const tz = hostTimezone(props.timezone);
  const now = useNow(30_000);
  const wall = wallParts(now, tz);
  const today = wall.ymd;
  const hour12 = wantsHour12(props.timeFormat, locale);
  const weekStart = cfg.startDay === 'monday' ? 1 : 0;
  const fontPx = props.style.fontSize > 0 ? props.style.fontSize : 16;

  const theme = React.useMemo(
    () => resolveTheme(cfg.theme, props.style, cfg.accentColor),
    [cfg.theme, cfg.accentColor, props.style.backgroundColor, props.style.textColor],
  );
  const people = React.useMemo(() => cleanPeople(props.people), [props.people]);

  // What the family has tapped on the wall.
  const [view, setView] = React.useState<ViewId>(cfg.defaultView);
  // null follows today, so the wall rolls over at midnight on its own.
  const [anchorPick, setAnchorPick] = React.useState<Ymd | null>(null);
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [open, setOpen] = React.useState<OpenEvent | null>(null);

  const anchor = anchorPick ?? today;
  const activeView: ViewId = view === 'chores' && !cfg.showChores ? cfg.defaultView : view;

  // Editing the starting view in the editor should show up straight away.
  React.useEffect(() => setView(cfg.defaultView), [cfg.defaultView]);

  // Wall behavior: after a quiet spell, go back to today and the starting view.
  const lastTouch = React.useRef(Date.now());
  const dirty = anchorPick !== null || activeView !== cfg.defaultView || selected.size > 0 || open !== null;
  const dirtyRef = React.useRef(dirty);
  dirtyRef.current = dirty;
  React.useEffect(() => {
    if (cfg.returnToTodaySeconds <= 0) return;
    const id = setInterval(() => {
      if (dirtyRef.current && Date.now() - lastTouch.current > cfg.returnToTodaySeconds * 1000) {
        setView(cfg.defaultView);
        setAnchorPick(null);
        setSelected(new Set());
        setOpen(null);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [cfg.returnToTodaySeconds, cfg.defaultView]);
  const touch = React.useCallback(() => {
    lastTouch.current = Date.now();
  }, []);

  const calendarView = activeView === 'chores' ? cfg.defaultView : activeView;
  const views: ViewId[] = cfg.showChores ? ['day', 'week', 'month', 'schedule', 'chores'] : ['day', 'week', 'month', 'schedule'];

  const goDay = React.useCallback((day: Ymd) => {
    setAnchorPick(day === today ? null : day);
    setView('day');
  }, [today]);

  const buildCtx = (legend: Legend): ViewCtx => {
    const cache = new Map<string, EventLook>();
    return {
      today,
      nowMin: wall.minutes,
      locale,
      hour12,
      cfg,
      weekStart,
      legend,
      theme,
      width,
      height,
      fontPx,
      look: (e) => {
        const color = colorOf(e, legend, cfg.accentColor);
        let look = cache.get(color);
        if (!look) {
          const pill = pillFor(color, cfg.accentColor, theme.dark, theme.surface);
          look = { ...pill, on: css(readableOn(toRgb(color, [47, 111, 237]))) };
          cache.set(color, look);
        }
        return look;
      },
      owners: (e) => ownersOf(e, legend),
      open: (e, day) => setOpen({ e, day, legend }),
      openDay: goDay,
    };
  };

  // The chores view needs no events, so it shares a context with no legend.
  const ctx = buildCtx(EMPTY_LEGEND);

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = React.useCallback(() => setSelected(new Set()), []);

  const title = activeView === 'chores'
    ? formatDay(today, locale, { weekday: 'long', month: 'long', day: 'numeric' })
    : rangeLabel(calendarView, anchor, weekStart, locale, today.slice(0, 4));

  const atToday = showsToday(calendarView, anchor, today, weekStart);

  const rootStyle: React.CSSProperties = {
    ...hostFrameStyle(props.style),
    ...(theme.rootBackground ? { backgroundColor: theme.rootBackground } : {}),
    ...(theme.vars as React.CSSProperties),
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--fwc-text)',
  };

  const needsSetup = props.calendarSetup === 'noSources' && activeView !== 'chores';

  return (
    <div
      ref={rootRef}
      className="fwc"
      style={rootStyle}
      role="region"
      aria-label={S.views}
      onPointerDownCapture={touch}
      onKeyDownCapture={touch}
      onScrollCapture={touch}
      onWheelCapture={touch}
    >
      <style>{CSS}</style>
      <Header
        title={title}
        view={activeView}
        views={views}
        onView={(v) => {
          setView(v);
          touch();
        }}
        onPrev={() => setAnchorPick(stepAnchor(calendarView, anchor, -1))}
        onNext={() => setAnchorPick(stepAnchor(calendarView, anchor, 1))}
        onToday={() => setAnchorPick(null)}
        atToday={atToday}
        showNav={activeView !== 'chores'}
      />
      {activeView === 'chores' ? (
        <ChoresView ctx={ctx} tappable={cfg.choresTappable} />
      ) : needsSetup ? (
        <div className="fwc-body">
          <StateCard icon={<Icon.Calendar size="1.6em" />} title={S.setupTitle} body={S.setupBody} />
        </div>
      ) : (
        <CalendarScreen
          view={calendarView}
          anchor={anchor}
          weekStart={weekStart}
          tz={tz}
          people={people}
          selected={selected}
          onToggle={toggle}
          onClear={clear}
          buildCtx={buildCtx}
        />
      )}
      {open && (
        <EventSheet
          e={open.e}
          day={open.day}
          ctx={buildCtx(open.legend)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
