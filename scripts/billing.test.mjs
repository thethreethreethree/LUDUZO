// Unit test for money formatting (@/lib/billing formatMoney). No deps —
// run with:  node --experimental-strip-types scripts/billing.test.mjs
//
// Assertions use "contains" (not exact strings) so they survive ICU/locale
// differences across Node versions — we care about the amount, sign, and no-throw.

const { formatMoney } = await import("../src/lib/billing.ts");

let failed = 0;
const has = (name, value, ...parts) => {
  const s = String(value);
  const missing = parts.filter((p) => !s.includes(p));
  if (missing.length === 0) console.log(`  ✓ ${name}  (${s})`);
  else { failed++; console.log(`  ✗ ${name}: "${s}" missing ${JSON.stringify(missing)}`); }
};

has("1000c → $10.00", formatMoney(1000), "$", "10.00");
has("0c → 0.00", formatMoney(0), "0.00");
has("null → 0.00 (no throw)", formatMoney(null), "0.00");
has("1999c → 19.99", formatMoney(1999), "19.99");
has("1c → 0.01 (no rounding loss)", formatMoney(1), "0.01");
has("negative → sign + amount", formatMoney(-500), "-", "5.00");
has("eur → formats, no throw", formatMoney(1000, "eur"), "10.00");
has("gbp 1050c → 10.50", formatMoney(1050, "gbp"), "10.50");
has("invalid currency → fallback branch", formatMoney(1000, "zzz"), "10.00", "ZZZ");

console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);
