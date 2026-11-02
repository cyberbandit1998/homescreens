// Shapes the host hands this plugin. They mirror the host's own types
// (CalendarEvent, CalendarPerson) but are declared here so the bundle has no
// dependency on host source.

export interface CalendarEvent {
  id: string;
  title: string;
  /** Timed events: an ISO instant. All-day events: "YYYY-MM-DD". */
  start: string;
  /** Same format as `start`. For all-day events the end day is exclusive. */
  end: string;
  location?: string;
  description?: string;
  allDay: boolean;
  calendarColor?: string;
  sourceId?: string;
  sourceName?: string;
  kind?: 'birthday' | 'holiday' | 'event';
  birthYear?: number;
}

/** A family member and the calendar sources that belong to them. */
export interface Person {
  id: string;
  name: string;
  color: string;
  sourceIds: string[];
}

export interface SourceStatus {
  id: string;
  name?: string;
  ok: boolean;
  error?: string;
}

export type CalendarViewId = 'day' | 'week' | 'month' | 'schedule';
export type ViewId = CalendarViewId | 'chores';
export type ThemeMode = 'auto' | 'light' | 'dark';

export interface PluginConfig {
  defaultView: CalendarViewId;
  theme: ThemeMode;
  accentColor: string;
  startDay: 'sunday' | 'monday';
  showWeekends: boolean;
  dayStartHour: number;
  dayEndHour: number;
  showPeopleBar: boolean;
  showChores: boolean;
  choresTappable: boolean;
  returnToTodaySeconds: number;
  maxEventsPerDay: number;
}

export const DEFAULT_CONFIG: PluginConfig = {
  defaultView: 'week',
  theme: 'auto',
  accentColor: '#2f6fed',
  startDay: 'sunday',
  showWeekends: true,
  dayStartHour: 6,
  dayEndHour: 22,
  showPeopleBar: true,
  showChores: true,
  choresTappable: true,
  returnToTodaySeconds: 120,
  maxEventsPerDay: 4,
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Config straight from config.json can be missing, stale or hand-edited. */
export function readConfig(raw: Record<string, unknown> | undefined): PluginConfig {
  const c = raw ?? {};
  const dayStartHour = clampInt(c.dayStartHour, 0, 12, DEFAULT_CONFIG.dayStartHour);
  const dayEndHour = Math.max(
    dayStartHour + 4,
    clampInt(c.dayEndHour, 1, 24, DEFAULT_CONFIG.dayEndHour),
  );
  const accent = typeof c.accentColor === 'string' && c.accentColor.trim() ? c.accentColor.trim() : DEFAULT_CONFIG.accentColor;
  return {
    defaultView: oneOf(c.defaultView, ['day', 'week', 'month', 'schedule'] as const, DEFAULT_CONFIG.defaultView),
    theme: oneOf(c.theme, ['auto', 'light', 'dark'] as const, DEFAULT_CONFIG.theme),
    accentColor: accent,
    startDay: oneOf(c.startDay, ['sunday', 'monday'] as const, DEFAULT_CONFIG.startDay),
    showWeekends: bool(c.showWeekends, DEFAULT_CONFIG.showWeekends),
    dayStartHour,
    dayEndHour: Math.min(24, dayEndHour),
    showPeopleBar: bool(c.showPeopleBar, DEFAULT_CONFIG.showPeopleBar),
    showChores: bool(c.showChores, DEFAULT_CONFIG.showChores),
    choresTappable: bool(c.choresTappable, DEFAULT_CONFIG.choresTappable),
    returnToTodaySeconds: clampInt(c.returnToTodaySeconds, 0, 600, DEFAULT_CONFIG.returnToTodaySeconds),
    maxEventsPerDay: clampInt(c.maxEventsPerDay, 1, 8, DEFAULT_CONFIG.maxEventsPerDay),
  };
}
