#!/usr/bin/env node
// ============================================================================
// PWA icon + manifest smoke test — no dependencies (Node 18+ built-in fetch).
//
// Codifies the manual production verifications from the 2026-07 PWA-icon fix so
// they can be re-run after any deploy:
//   1. /portal/icon rasterizes a same-origin image to a real PNG.
//   2. /portal/icon REJECTS a foreign URL (SSRF guard).
//   3. /portal/manifest hands the install PNG icon URLs (not raw SVG).
//
// Usage:  node scripts/smoke-pwa.mjs [baseUrl] [supabaseLogoUrl]
//   baseUrl defaults to https://luduzo.vercel.app
//   supabaseLogoUrl (optional) — a real https://<project>.supabase.co/storage/v1/
//     object/public/brand/... URL; enables the positive rasterize check. Without it
//     that check is skipped (the SSRF guard only allows this project's Supabase host,
//     so a generic image can't be used).
// Exit code 0 = all pass, 1 = a check failed.
// ============================================================================

const BASE = (process.argv[2] || "https://luduzo.vercel.app").replace(/\/$/, "");
const SUPABASE_LOGO = process.argv[3] || null;
const q = (o) => new URLSearchParams(o).toString();

let failed = 0;
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
};

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function main() {
  console.log(`PWA smoke test → ${BASE}\n`);

  if (SUPABASE_LOGO) {
    await check("/portal/icon rasterizes the real Supabase logo to PNG", async () => {
      const r = await fetch(`${BASE}/portal/icon?${q({ s: "512", logo: SUPABASE_LOGO, bg: "#0a0a0a" })}`);
      assert(r.status === 200, `expected 200, got ${r.status}`);
      assert((r.headers.get("content-type") || "").includes("image/png"), `expected image/png, got ${r.headers.get("content-type")}`);
    });
  } else {
    console.log("  – /portal/icon positive rasterize: SKIPPED (pass a Supabase logo URL as arg 2)");
  }

  await check("/portal/icon rejects a FOREIGN url (SSRF guard)", async () => {
    const r = await fetch(`${BASE}/portal/icon?${q({ s: "192", logo: "https://example.com/x.png", bg: "#0a0a0a" })}`, { redirect: "manual" });
    assert(r.status === 404, `expected 404 for a non-Supabase logo, got ${r.status}`);
  });

  await check("/portal/manifest serves PNG icon URLs (not raw SVG)", async () => {
    // A plausible Supabase-storage logo URL shape; the manifest only reflects params.
    const logo = `${BASE}/android-chrome-512x512.png`; // any allowed-looking https url
    const r = await fetch(`${BASE}/portal/manifest?${q({ name: "SmokeGym", logo, bg: "#0a0a0a" })}`);
    assert(r.status === 200, `expected 200, got ${r.status}`);
    const m = await r.json();
    assert(Array.isArray(m.icons) && m.icons.length > 0, "manifest has no icons");
    const anySvg = m.icons.some((i) => (i.type || "").includes("svg"));
    assert(!anySvg, "manifest still declares a raw SVG icon (should be rasterized PNG)");
    const allViaGenerator = m.icons.every((i) => (i.src || "").includes("/portal/icon"));
    assert(allViaGenerator, "manifest icons should point at the /portal/icon PNG generator");
  });

  console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
