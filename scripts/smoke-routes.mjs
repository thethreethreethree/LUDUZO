#!/usr/bin/env node
// ============================================================================
// Auth-gate + critical-route smoke test — no dependencies (Node 18+ fetch).
//
// The member portal and staff dashboard MUST NOT be reachable without a session.
// That property lives entirely in src/lib/supabase/middleware.ts (redirect to
// /login for any /dashboard or /portal path except the exact public exceptions
// /portal/manifest and /portal/icon). A regression there silently exposes member
// data, so this codifies the guarantee as a re-runnable post-deploy check —
// GET-only, no mutation, safe against production.
//
// Verified expectations (read from middleware.ts, not assumed):
//   • unauthenticated /dashboard, /portal      -> 307 redirect to /login
//   • /login                                   -> 200
//   • /portal/manifest (exact public exception)-> 200 (reachable without a cookie)
//   • /portal/manifestX (NOT an exact match)   -> 307 to /login  (exact-match guard, S2)
//
// Usage:  node scripts/smoke-routes.mjs [baseUrl]   (defaults to production)
// Exit code 0 = all pass, 1 = a check failed.
// ============================================================================

const BASE = (process.argv[2] || "https://luduzo.vercel.app").replace(/\/$/, "");

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

// GET without following redirects, so we can inspect the auth-gate 307 directly.
async function get(path) {
  return fetch(`${BASE}${path}`, { redirect: "manual", headers: { "accept": "text/html" } });
}
function redirectsToLogin(r) {
  // NextResponse.redirect defaults to 307; accept any 3xx to be resilient to framework changes.
  assert(r.status >= 300 && r.status < 400, `expected a 3xx redirect, got ${r.status}`);
  const loc = r.headers.get("location");
  assert(loc, "redirect had no Location header");
  assert(new URL(loc, BASE).pathname === "/login", `expected redirect to /login, got ${loc}`);
}

async function main() {
  console.log(`Auth-gate smoke test → ${BASE}\n`);

  await check("/login renders (200)", async () => {
    const r = await get("/login");
    assert(r.status === 200, `expected 200, got ${r.status}`);
  });

  await check("unauthenticated /dashboard → redirect to /login (staff gate)", async () => {
    redirectsToLogin(await get("/dashboard"));
  });

  await check("unauthenticated /portal → redirect to /login (member gate — no data leak)", async () => {
    redirectsToLogin(await get("/portal"));
  });

  await check("/portal/manifest is reachable without a session (exact public exception)", async () => {
    const r = await get("/portal/manifest?name=SmokeGym&bg=%230a0a0a");
    assert(r.status === 200, `expected 200, got ${r.status}`);
  });

  await check("exact-match guard: /portal/manifestX is NOT public → redirect (S2)", async () => {
    // A prefix-match bug (startsWith instead of exact) would leak this as public.
    redirectsToLogin(await get("/portal/manifestX"));
  });

  console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
