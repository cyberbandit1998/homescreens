import type { Person } from '../types';
import type { NormEvent } from './events';

// The host's Settings > Family decides who owns which calendar. When nobody
// owns anything we fall back to one entry per calendar, so the filter row is
// useful in every household.

export interface LegendEntry {
  id: string;
  name: string;
  color: string;
  /** Calendar source ids that belong to this entry. */
  sourceIds: string[];
}

export function cleanPeople(input: unknown): Person[] {
  if (!Array.isArray(input)) return [];
  const out: Person[] = [];
  for (const p of input) {
    if (!p || typeof p !== 'object') continue;
    const { id, name, color, sourceIds } = p as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') continue;
    out.push({
      id,
      name,
      color: typeof color === 'string' ? color : '#2f6fed',
      sourceIds: Array.isArray(sourceIds) ? sourceIds.filter((s): s is string => typeof s === 'string') : [],
    });
  }
  return out;
}

export interface Legend {
  mode: 'people' | 'calendars';
  entries: LegendEntry[];
}

export function buildLegend(people: readonly Person[], events: readonly NormEvent[]): Legend {
  const owning = people.filter((p) => p.sourceIds.length > 0);
  if (owning.length > 0) {
    return {
      mode: 'people',
      entries: owning.map((p) => ({ id: p.id, name: p.name, color: p.color, sourceIds: p.sourceIds })),
    };
  }
  const seen = new Map<string, LegendEntry>();
  for (const e of events) {
    const sourceId = e.raw.sourceId;
    if (!sourceId || seen.has(sourceId)) continue;
    seen.set(sourceId, {
      id: sourceId,
      name: e.raw.sourceName || sourceId,
      color: e.raw.calendarColor || '#2f6fed',
      sourceIds: [sourceId],
    });
  }
  return { mode: 'calendars', entries: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

/** The legend entries that own an event (empty = shared by the household). */
export function ownersOf(e: NormEvent, legend: Legend): LegendEntry[] {
  const sourceId = e.raw.sourceId;
  if (!sourceId) return [];
  return legend.entries.filter((entry) => entry.sourceIds.includes(sourceId));
}

/** An event's color: its first owner's color, else its own calendar's. */
export function colorOf(e: NormEvent, legend: Legend, fallback: string): string {
  if (legend.mode === 'people') {
    const owner = ownersOf(e, legend)[0];
    if (owner) return owner.color;
  }
  return e.raw.calendarColor || fallback;
}

/**
 * Keep events that belong to a selected entry. Shared events (no owner, or
 * holidays) stay visible unless `includeShared` is off, matching how the
 * host's own calendar modules treat a people filter.
 */
export function filterEvents(
  events: readonly NormEvent[],
  legend: Legend,
  selected: ReadonlySet<string>,
  includeShared = true,
): NormEvent[] {
  if (selected.size === 0) return [...events];
  return events.filter((e) => {
    const owners = ownersOf(e, legend);
    if (owners.length === 0) return includeShared;
    return owners.some((o) => selected.has(o.id));
  });
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return Array.from(words[0])[0].toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
}
