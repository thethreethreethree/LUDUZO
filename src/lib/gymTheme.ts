// Single source of truth for per-gym theming math, shared by the member portal
// layout (which applies it) and the settings preview (which shows it) so they can
// never drift (A13 — author the space once).

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const okHex = (c?: string | null) => (c && HEX.test(c) ? c : null);

export const DEFAULT_PRIMARY = "#f5c518";
export const DEFAULT_SECONDARY = "#161616";
export const DEFAULT_BACKGROUND = "#0a0a0a";

// WCAG relative luminance of a #rrggbb colour (0 = black … 1 = white).
export function luminance(hex: string): number {
  const v = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * v(1) + 0.7152 * v(3) + 0.0722 * v(5);
}

// Legible text for one surface colour: dark text on a light surface, light on dark.
function textFor(surface: string) {
  const light = luminance(surface) > 0.5;
  return { text: light ? "#141414" : "#ededed", textSec: light ? "#565656" : "#8a8a8a" };
}

// Legible text colours derived PER SURFACE — text on the page background is judged
// against Background, text inside cards against Secondary. This lets a gym pick a
// Background and Secondary on opposite luminance sides (e.g. dark page + light cards)
// and stay readable on both. Defaults (#0a0a0a bg, #161616 cards, #f5c518 primary)
// resolve to today's exact colours — nothing changes until a gym picks custom ones.
export function textColors(primary: string, secondary: string, background: string) {
  return {
    bg: textFor(background),   // text directly on the page canvas
    card: textFor(secondary),  // text inside cards / panels
    onPrimary: luminance(primary) > 0.5 ? "#0a0a0a" : "#ffffff", // text on a Primary fill
  };
}
