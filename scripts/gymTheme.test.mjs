// Unit test for the per-gym theming contrast math (@/lib/gymTheme). No deps —
// run with:  node --experimental-strip-types scripts/gymTheme.test.mjs
//
// Guards the F1 fix: text colour is derived PER SURFACE (page background vs cards),
// so a gym can pick a Background and Secondary on opposite luminance sides and stay
// legible on both. A regression here (back to one shared text colour) fails these.

const { textColors, luminance } = await import("../src/lib/gymTheme.ts");

const DARK_TEXT = "#141414";
const LIGHT_TEXT = "#ededed";

let failed = 0;
const eq = (name, got, want) => {
  if (got === want) { console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}: got ${got}, want ${want}`); }
};
const ok = (name, cond) => { if (cond) console.log(`  ✓ ${name}`); else { failed++; console.log(`  ✗ ${name}`); } };

// luminance sanity
ok("luminance(#ffffff) ≈ 1", Math.abs(luminance("#ffffff") - 1) < 0.001);
ok("luminance(#000000) ≈ 0", luminance("#000000") < 0.001);
ok("luminance(#f5c518) > 0.5 (gold is light)", luminance("#f5c518") > 0.5);

// 1) Default palette (dark bg + dark cards + gold primary) → today's colours.
const def = textColors("#f5c518", "#161616", "#0a0a0a");
eq("default: page text is light", def.bg.text, LIGHT_TEXT);
eq("default: card text is light", def.card.text, LIGHT_TEXT);
eq("default: onPrimary is dark (gold button → black text)", def.onPrimary, "#0a0a0a");

// 2) MISMATCHED — dark page, LIGHT cards. The F1 case: each surface independent.
const m1 = textColors("#e22400", "#ffffff", "#0a0a0a");
eq("mismatch A: page text light (on dark bg)", m1.bg.text, LIGHT_TEXT);
eq("mismatch A: card text dark (on light card)", m1.card.text, DARK_TEXT);
ok("mismatch A: the two surfaces differ (per-surface, not shared)", m1.bg.text !== m1.card.text);

// 3) MISMATCHED — LIGHT page, dark cards.
const m2 = textColors("#e22400", "#161616", "#f5f5f5");
eq("mismatch B: page text dark (on light bg)", m2.bg.text, DARK_TEXT);
eq("mismatch B: card text light (on dark card)", m2.card.text, LIGHT_TEXT);
ok("mismatch B: the two surfaces differ", m2.bg.text !== m2.card.text);

// 4) onPrimary contrast follows the primary's luminance.
eq("onPrimary: dark primary → white text", textColors("#101820", "#161616", "#0a0a0a").onPrimary, "#ffffff");
eq("onPrimary: light primary → dark text", textColors("#ffe066", "#161616", "#0a0a0a").onPrimary, "#0a0a0a");

console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);
