// Unit test for the shared check-in helpers (@/lib/checkins). No deps — run with:
//   node --experimental-strip-types --import ./scripts/register-tsalias.mjs scripts/checkins.test.mjs
//
// checkins.ts imports "@/lib/pg-errors", so it needs the alias resolve hook (register-
// tsalias.mjs) to load under strip-types. These helpers translate the DB unique-violation
// (SQLSTATE 23505 from the 0018 partial index that backstops the app-level "already
// checked in?" guard) into a per-surface friendly message. checkinErrorMessage's branching
// (no error / conflict / other error) is user-facing, so it's worth pinning.

const m = await import("../src/lib/checkins.ts");

let failed = 0;
const eq = (name, got, want) => {
  if (got === want) console.log(`  ✓ ${name}`);
  else { failed++; console.log(`  ✗ ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

// isOpenCheckinConflict — true only on a unique_violation (a raced second open check-in).
eq("conflict: 23505 → true", m.isOpenCheckinConflict({ code: "23505" }), true);
eq("conflict: 23514 (check) → false", m.isOpenCheckinConflict({ code: "23514" }), false);
eq("conflict: null code → false", m.isOpenCheckinConflict({ code: null }), false);
eq("conflict: null error → false", m.isOpenCheckinConflict(null), false);

// checkinErrorMessage — no error → empty; conflict → friendly (default + per-surface
// override); any other error → its raw message passed through unchanged.
eq("msg: null error → ''", m.checkinErrorMessage(null), "");
eq(
  "msg: conflict → default friendly",
  m.checkinErrorMessage({ code: "23505", message: "duplicate key ..." }),
  "Member is already checked in.",
);
eq(
  "msg: conflict → per-surface override",
  m.checkinErrorMessage({ code: "23505", message: "duplicate key ..." }, "You're already checked in."),
  "You're already checked in.",
);
eq(
  "msg: other error → raw message",
  m.checkinErrorMessage({ code: "23503", message: "insert violates foreign key" }),
  "insert violates foreign key",
);
eq(
  "msg: other error ignores conflictMessage",
  m.checkinErrorMessage({ code: "42501", message: "permission denied" }, "You're already checked in."),
  "permission denied",
);

console.log(`\n${failed ? `FAILED (${failed})` : "ALL PASS"}`);
process.exit(failed ? 1 : 0);
