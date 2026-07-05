// Unit test for Supabase env access (@/lib/env). No deps —
// run with:  node --experimental-strip-types scripts/env.test.mjs
//
// Guards two contracts: (1) importing the module NEVER throws even with no env — this
// is what lets `next build` prerender without a populated .env; validation is deferred
// to call time. (2) getSupabaseEnv() returns the values when set and throws a helpful,
// .env-mentioning error when either is missing.

// Start from a known-clean env so the assertions are deterministic regardless of shell.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// (1) Import must succeed with NO env set (call-time, not import-time, validation).
const { getSupabaseEnv } = await import("../src/lib/env.ts");

let failed = 0;
const ok = (name, cond) => { if (cond) console.log(`  ✓ ${name}`); else { failed++; console.log(`  ✗ ${name}`); } };
const eq = (name, got, want) => { if (got === want) console.log(`  ✓ ${name}`); else { failed++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); } };
const throws = (fn) => { try { fn(); return null; } catch (e) { return e; } };

ok("import did not throw with empty env (build-safe contract)", typeof getSupabaseEnv === "function");

// (2a) both missing → throws a helpful message.
let e = throws(() => getSupabaseEnv());
ok("throws when both env vars missing", e !== null);
ok("error message points at .env", !!e && e.message.includes(".env"));

// (2b) only one set → still throws.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
ok("throws when only the URL is set", throws(() => getSupabaseEnv()) !== null);

// (2c) both set → returns them.
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-123";
const got = getSupabaseEnv();
eq("returns url when both set", got.url, "https://proj.supabase.co");
eq("returns anonKey when both set", got.anonKey, "anon-key-123");

console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);
