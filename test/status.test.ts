import { describe, expect, it } from 'vitest';
import { failingMessage, sourceNames } from '../src/lib/status';

const HASH = '1d1a1e606c47d4ff13e908f50a530fdef2d205021d6d27c94c67d50b54263362';

describe('failingMessage', () => {
  const names = new Map([[HASH, 'Early Release']]);

  it('says nothing when everything is updating', () => {
    expect(failingMessage([], names)).toBeNull();
  });

  it('uses the name the hub gives', () => {
    expect(failingMessage([{ id: 'x', name: "Mia's calendar", ok: false }], new Map())).toBe("Not updating: Mia's calendar");
  });

  it('looks the name up from the calendar’s own events when the hub sends only an id', () => {
    expect(failingMessage([{ id: HASH, ok: false }], names)).toBe('Not updating: Early Release');
    // A blank name counts as no name.
    expect(failingMessage([{ id: HASH, name: '  ', ok: false }], names)).toBe('Not updating: Early Release');
  });

  it('never shows a raw id, even when it cannot find a name', () => {
    const one = failingMessage([{ id: HASH, ok: false }], new Map())!;
    expect(one).toBe("A calendar isn't updating");
    expect(one).not.toContain(HASH);
    const two = failingMessage([{ id: HASH, ok: false }, { id: 'other-hash', ok: false }], new Map())!;
    expect(two).toBe("2 calendars aren't updating");
  });

  it('mixes known and unknown calendars', () => {
    const out = failingMessage([{ id: HASH, ok: false }, { id: 'zzz', ok: false }], names)!;
    expect(out).toBe('Not updating: Early Release and 1 other calendar');
    expect(failingMessage([{ id: HASH, ok: false }, { id: 'a', ok: false }, { id: 'b', ok: false }], names)).toBe(
      'Not updating: Early Release and 2 other calendars',
    );
  });

  it('lists each name once', () => {
    expect(failingMessage([{ id: HASH, ok: false }, { id: 'again', name: 'Early Release', ok: false }], names)).toBe(
      'Not updating: Early Release',
    );
  });

  it('adds the hub’s plain reason only when one calendar is the problem', () => {
    expect(failingMessage([{ id: HASH, ok: false, error: 'Could not reach the link' }], names)).toBe(
      'Not updating: Early Release · Could not reach the link',
    );
    expect(
      failingMessage(
        [{ id: HASH, ok: false, error: 'Could not reach the link' }, { id: 'b', name: 'B', ok: false, error: 'Nope' }],
        names,
      ),
    ).not.toContain('Could not reach');
  });
});

describe('sourceNames', () => {
  it('maps source ids to the names events carry', () => {
    const map = sourceNames([
      { raw: { sourceId: 'a', sourceName: 'Alpha' } },
      { raw: { sourceId: 'a', sourceName: 'Other' } },
      { raw: { sourceId: 'b', sourceName: '  ' } },
      { raw: { sourceName: 'No id' } },
    ]);
    expect([...map.entries()]).toEqual([['a', 'Alpha']]);
  });
});
