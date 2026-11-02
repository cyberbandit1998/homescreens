import { describe, expect, it } from 'vitest';
import { contrast, ensureContrast, pillFor, toRgb, type RGB } from '../src/lib/colors';
import { resolveTheme } from '../src/lib/theme';
import { DEFAULT_CONFIG, readConfig } from '../src/types';

const WHITE: RGB = [255, 255, 255];

describe('contrast helpers', () => {
  it('computes WCAG ratios', () => {
    expect(contrast([0, 0, 0], WHITE)).toBeCloseTo(21, 0);
    expect(contrast(WHITE, WHITE)).toBeCloseTo(1, 5);
  });

  it('darkens a light color until it passes on a light fill', () => {
    const out = ensureContrast([250, 220, 60], [255, 255, 255], 4.5);
    expect(contrast(out, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens on a dark fill', () => {
    const out = ensureContrast([20, 40, 120], [20, 24, 31], 4.5);
    expect(contrast(out, [20, 24, 31])).toBeGreaterThanOrEqual(4.5);
  });

  it('makes event cards readable for every kind of calendar color', () => {
    const colors = ['#ffeb3b', '#ffffff', '#000000', '#e91e63', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', 'not-a-color', undefined];
    for (const dark of [false, true]) {
      const surface: RGB = dark ? [20, 24, 31] : WHITE;
      for (const c of colors) {
        const pill = pillFor(c, '#2f6fed', dark, surface);
        const fill = toRgb(pill.bg, WHITE);
        // Well above AA (4.5) on purpose: finished events are desaturated, which shifts
        // luminance slightly, so the headroom keeps them readable.
        expect(contrast(toRgb(pill.fg, WHITE), fill), `${c} title dark=${dark}`).toBeGreaterThanOrEqual(7);
        expect(contrast(toRgb(pill.sub, WHITE), fill), `${c} subtitle dark=${dark}`).toBeGreaterThanOrEqual(5.5);
      }
    }
  });
});

describe('resolveTheme', () => {
  const light = { backgroundColor: '#ffffff', textColor: '#1c2430' };
  const wall = { backgroundColor: 'rgba(0, 0, 0, 0.4)', textColor: '#ffffff' };

  it('auto follows the module background', () => {
    expect(resolveTheme('auto', light, '#2f6fed').dark).toBe(false);
    expect(resolveTheme('auto', wall, '#2f6fed').dark).toBe(true);
    expect(resolveTheme('auto', { backgroundColor: '#101820', textColor: '#fff' }, '#2f6fed').dark).toBe(true);
  });

  it('a forced theme that disagrees with the module paints its own page', () => {
    const forced = resolveTheme('light', wall, '#2f6fed');
    expect(forced.dark).toBe(false);
    expect(forced.rootBackground).toBeDefined();
    expect(resolveTheme('light', light, '#2f6fed').rootBackground).toBeUndefined();
  });

  it('ignores a host text color that would be unreadable', () => {
    const t = resolveTheme('auto', { backgroundColor: '#ffffff', textColor: '#ffffff' }, '#2f6fed');
    expect(t.vars['--fwc-text']).not.toBe('rgb(255, 255, 255)');
  });

  it('keeps muted text and button text readable on every palette', () => {
    for (const style of [light, wall]) {
      for (const mode of ['auto', 'light', 'dark'] as const) {
        for (const accent of ['#2f6fed', '#ffeb3b', '#111111']) {
          const t = resolveTheme(mode, style, accent);
          const page = toRgb(t.vars['--fwc-bg'], WHITE);
          const tile = toRgb(t.vars['--fwc-tile'], WHITE);
          expect(contrast(toRgb(t.vars['--fwc-text'], WHITE), page)).toBeGreaterThanOrEqual(7);
          expect(contrast(toRgb(t.vars['--fwc-muted'], WHITE), tile)).toBeGreaterThanOrEqual(4.5);
          expect(
            contrast(toRgb(t.vars['--fwc-on-accent'], WHITE), toRgb(t.vars['--fwc-accent'], WHITE)),
          ).toBeGreaterThanOrEqual(4.5);
          // Accent used as text, on the "today" tint it is drawn over.
          expect(
            contrast(toRgb(t.vars['--fwc-accent-text'], WHITE), toRgb(t.vars['--fwc-today'], WHITE)),
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe('readConfig', () => {
  it('uses the defaults for missing or nonsense values', () => {
    expect(readConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(readConfig({ defaultView: 'bogus', theme: 3, startDay: null, maxEventsPerDay: 'x' })).toEqual(DEFAULT_CONFIG);
  });

  it('clamps numbers and keeps the day window sensible', () => {
    const c = readConfig({ maxEventsPerDay: 99, returnToTodaySeconds: -5, dayStartHour: 10, dayEndHour: 11 });
    expect(c.maxEventsPerDay).toBe(8);
    expect(c.returnToTodaySeconds).toBe(0);
    expect(c.dayEndHour - c.dayStartHour).toBeGreaterThanOrEqual(4);
  });

  it('accepts valid choices', () => {
    const c = readConfig({ defaultView: 'month', theme: 'dark', startDay: 'monday', showChores: false, accentColor: ' #ff00aa ' });
    expect(c).toMatchObject({ defaultView: 'month', theme: 'dark', startDay: 'monday', showChores: false, accentColor: '#ff00aa' });
  });
});
