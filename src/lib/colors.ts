import { alphaOf, parseColor } from '../host-style';

export type RGB = [number, number, number];

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

export function toRgb(color: string | undefined, fallback: RGB): RGB {
  return (color && parseColor(color)) || fallback;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

export function css(c: RGB): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function rgba(c: RGB, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

export function luminance(c: RGB): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Nudge `fg` toward black or white until it reads on `bg` (WCAG AA by default). */
export function ensureContrast(fg: RGB, bg: RGB, min = 4.5): RGB {
  const target = luminance(bg) > 0.4 ? BLACK : WHITE;
  let out = fg;
  for (let t = 0; t <= 1.0001 && contrast(out, bg) < min; t += 0.04) out = mix(fg, target, t);
  return contrast(out, bg) >= min ? out : target;
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: RGB): RGB {
  return contrast(WHITE, bg) >= contrast(BLACK, bg) ? WHITE : BLACK;
}

export interface Pill {
  /** Soft tinted fill. */
  bg: string;
  /** Text color that passes AA on the fill. */
  fg: string;
  /** Saturated edge / dot color. */
  bar: string;
  /** Muted text (times, places) that still passes AA on the fill. */
  sub: string;
}

/**
 * A soft pastel card for an event: tinted fill, a strong left bar, and text
 * darkened (or lightened, on dark themes) until it passes contrast.
 */
export function pillFor(color: string | undefined, fallback: string, dark: boolean, surface: RGB): Pill {
  const base = toRgb(color, toRgb(fallback, [47, 111, 237]));
  // On a dark page a bright color (yellow, white) tinted at full strength turns the card mid-gray,
  // where no text reads well. Light colors get a weaker tint so the card stays dark and crisp.
  const strength = dark ? 0.32 - 0.16 * luminance(base) : 0.16;
  const fill = mix(surface, base, strength);
  // Targets sit above AA (7 and 5.5) because finished events are desaturated,
  // which nudges luminance a little; the headroom keeps them readable.
  const fg = ensureContrast(mix(base, dark ? WHITE : BLACK, dark ? 0.55 : 0.45), fill, 7);
  const sub = ensureContrast(mix(base, dark ? WHITE : BLACK, dark ? 0.35 : 0.3), fill, 5.5);
  return { bg: css(fill), fg: css(fg), bar: css(base), sub: css(sub) };
}

export function isOpaque(color: string): boolean {
  return alphaOf(color) >= 0.5;
}
