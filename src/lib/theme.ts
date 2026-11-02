import type { ThemeMode } from '../types';
import { alphaOf } from '../host-style';
import { contrast, css, ensureContrast, isOpaque, luminance, mix, readableOn, rgba, toRgb, type RGB } from './colors';

export interface Theme {
  dark: boolean;
  /** Solid color the cards sit on, used to compute readable tints. */
  surface: RGB;
  /** Set when the chosen theme disagrees with the module's own background. */
  rootBackground?: string;
  vars: Record<string, string>;
}

const LIGHT = {
  bg: [255, 255, 255] as RGB,
  tile: [245, 247, 250] as RGB,
  border: [229, 233, 239] as RGB,
  text: [28, 36, 48] as RGB,
  muted: [91, 102, 118] as RGB,
};

const DARK = {
  bg: [20, 24, 31] as RGB,
  tile: [32, 38, 48] as RGB,
  border: [52, 60, 74] as RGB,
  text: [243, 245, 247] as RGB,
  muted: [166, 177, 192] as RGB,
};

interface StyleInput {
  backgroundColor: string;
  textColor: string;
}

/**
 * Light or dark, from the setting or (in auto) from the module's background.
 * The host's own Text color is honored when it stays readable, so the style
 * panel still does something.
 */
export function resolveTheme(mode: ThemeMode, style: StyleInput, accentColor: string): Theme {
  const bg = toRgb(style.backgroundColor, LIGHT.bg);
  const bgIsLight = luminance(bg) > 0.45 && isOpaque(style.backgroundColor);
  const dark = mode === 'dark' ? true : mode === 'light' ? false : !bgIsLight;
  const p = dark ? DARK : LIGHT;

  // The page color the cards sit on: the module's own background when it
  // agrees with the theme, the theme's page color when it does not.
  const mismatch = mode !== 'auto' && dark === bgIsLight;
  const page: RGB = mismatch || alphaOf(style.backgroundColor) < 0.5 ? p.bg : bg;
  const tile = mix(page, dark ? ([255, 255, 255] as RGB) : ([0, 0, 0] as RGB), dark ? 0.07 : 0.035);
  const border = mix(page, dark ? ([255, 255, 255] as RGB) : ([0, 0, 0] as RGB), dark ? 0.16 : 0.09);

  const hostText = toRgb(style.textColor, p.text);
  const text = contrast(hostText, page) >= 7 ? hostText : p.text;
  const muted = ensureContrast(mix(text, page, 0.38), tile, 4.5);

  const accent = toRgb(accentColor, [47, 111, 237]);
  const accentFill = dark ? mix(accent, [255, 255, 255], 0.12) : accent;
  const onAccent = readableOn(accentFill);
  // Solid (not translucent) so a sticky column header can sit over scrolled content.
  const todayTint = mix(page, accentFill, dark ? 0.26 : 0.1);
  // The accent used as TEXT or an icon must read on the tinted tiles, not just on the page.
  const accentText = ensureContrast(accentFill, todayTint, 4.5);

  return {
    dark,
    surface: page,
    rootBackground: mismatch ? css(page) : undefined,
    vars: {
      '--fwc-bg': css(page),
      '--fwc-tile': css(tile),
      '--fwc-card': css(dark ? mix(page, [255, 255, 255], 0.1) : [255, 255, 255]),
      '--fwc-border': css(border),
      '--fwc-text': css(text),
      '--fwc-muted': css(muted),
      '--fwc-accent': css(accentFill),
      '--fwc-on-accent': css(onAccent),
      '--fwc-accent-soft': rgba(accentFill, dark ? 0.22 : 0.12),
      '--fwc-today': css(todayTint),
      '--fwc-accent-text': css(accentText),
      '--fwc-shadow': dark ? '0 1px 2px rgba(0,0,0,.5)' : '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)',
      '--fwc-focus': css(dark ? mix(accent, [255, 255, 255], 0.35) : mix(accent, [0, 0, 0], 0.15)),
    },
  };
}
