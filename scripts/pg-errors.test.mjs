// Unit test for Postgres SQLSTATE helpers (@/lib/pg-errors). No deps —
// run with:  node --experimental-strip-types scripts/pg-errors.test.mjs
//
// These classify DB errors so server actions can show human messages instead of raw
// Postgres text. isUniqueViolation underpins the race-safe check-in path (the DB unique
// index that backstops the app-level guard) and the "code already exists" coupon message.

const m = await import("../src/lib/pg-errors.ts");

let failed = 0;
const eq = (name, got, want) => {
  if (got === want) console.log(`  ✓ ${name}`);
  else { failed++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

// SQLSTATE constants are the canonical Postgres codes.
eq("PG_UNIQUE_VIOLATION = 23505", m.PG_UNIQUE_VIOLATION, "23505");
eq("PG_CHECK_VIOLATION = 23514", m.PG_CHECK_VIOLATION, "23514");
eq("PG_FOREIGN_KEY_VIOLATION = 23503", m.PG_FOREIGN_KEY_VIOLATION, "23503");

// isUniqueViolation
eq("unique: 23505 → true", m.isUniqueViolation({ code: "23505" }), true);
eq("unique: 23514 → false", m.isUniqueViolation({ code: "23514" }), false);
eq("unique: null code → false", m.isUniqueViolation({ code: null }), false);
eq("unique: null error → false", m.isUniqueViolation(null), false);

// isCheckViolation
eq("check: 23514 → true", m.isCheckViolation({ code: "23514" }), true);
eq("check: 23505 → false", m.isCheckViolation({ code: "23505" }), false);
eq("check: null error → false", m.isCheckViolation(null), false);

console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);
