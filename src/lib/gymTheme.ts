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

// Legible text colours derived from the chosen palette. Defaults (#0a0a0a bg,
// #f5c518 primary) resolve to today's exact colours — so nothing changes until a
// gym picks custom colours.
export function textColors(primary: string, secondary: string, background: string) {
  const lightSurface = luminance(background) > 0.5 || luminance(secondary) > 0.5;
  return {
    lightSurface,
    textMain: lightSurface ? "#141414" : "#ededed", // bone
    textSec: lightSurface ? "#565656" : "#8a8a8a",  // ash
    onPrimary: luminance(primary) > 0.5 ? "#0a0a0a" : "#ffffff", // text on Primary
  };
}
