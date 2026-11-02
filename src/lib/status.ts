import type { SourceStatus } from '../types';
import { S } from '../strings';

/** Calendar names the events themselves carry, by source id. */
export function sourceNames(events: readonly { raw: { sourceId?: string; sourceName?: string } }[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const { raw } of events) {
    const name = raw.sourceName?.trim();
    if (raw.sourceId && name && !names.has(raw.sourceId)) names.set(raw.sourceId, name);
  }
  return names;
}

/**
 * One plain sentence about calendars the hub cannot read right now, or null.
 *
 * The hub often names a failing calendar only by its internal id (a long
 * hash). That is never shown: the name is looked up from the events the
 * calendar did supply, and if there is none the wording stays generic.
 */
export function failingMessage(
  failing: readonly SourceStatus[],
  names: ReadonlyMap<string, string>,
): string | null {
  if (failing.length === 0) return null;

  const known: string[] = [];
  let unknown = 0;
  for (const f of failing) {
    const name = f.name?.trim() || names.get(f.id);
    if (!name) unknown++;
    else if (!known.includes(name)) known.push(name);
  }

  let text: string;
  if (known.length === 0) {
    text = unknown === 1 ? S.oneCalendarFailing : S.manyCalendarsFailing(unknown);
  } else {
    text = S.sourcesFailing(known.join(', ') + (unknown > 0 ? S.andMore(unknown) : ''));
  }

  // The hub's own plain-language reason helps when exactly one calendar is the problem.
  const reason = failing.length === 1 ? failing[0].error?.trim() : '';
  return reason ? `${text} · ${reason}` : text;
}
