# AUDIT-001 — UI ↔ Schema Contract (static drift check)

- **Date:** 2026-07-01
- **Stance:** Outside-view (§1.3) — read the code as if someone else wrote it.
- **Layer (AMD-006 four-layer):** Layer 2, *operational feature effectivity* — "does it
  actually work end-to-end," not "does it compile."
- **Method:** Ground-up audit (§1.7), foundation layer = the schema/UI contract.
- **Verification mode:** C2 (code-first / untested against a live DB). This audit is
  **static** — it proves the UI never references a name absent from the migration DDL. It
  does **not** prove the migrations themselves apply cleanly or that RLS admits the
  intended rows. That remains the founder's live-DB verification (see `supabase/APPLY.md`).

## Why this audit exists

In C2 mode the whole app builds green because TypeScript cannot see into Supabase's
schema. A `.select("column_that_does_not_exist")` or an `.rpc("fn", { wrong_arg })`
type-checks, ships, and then throws at runtime in front of the founder. That is the
"confident, well-formed failure" the constitution (§0, §5) exists to prevent. This audit
closes that specific gap without a live DB.

## Findings — all surfaces clean

| Surface | Method | Result |
|---|---|---|
| Table references (`.from("t")`) | 27 distinct UI tables vs `CREATE TABLE` set | **27/27 exist** |
| RPC references (`.rpc("fn")`) | 5 distinct UI RPCs vs `CREATE FUNCTION` set | **5/5 exist** |
| RPC argument names | each `{ p_… }` vs the function signature | **all match** |
| Read columns (`.select(...)`) | each selected identifier vs the *specific* target/embedded table's columns (per-table map) — embedded relations resolved to their base table | **no drift** |
| Write columns (`.insert/.update/.upsert`) | each payload key vs the *specific* target table's columns (per-table map, 28 tables) | **no drift** |
| Filter/order columns (`.eq/.in/.order/…`) | every filtered identifier vs DDL | **no drift** |

RPC arg detail (verified 1:1):
- `create_organization { p_name, p_slug }` ↔ `(p_name text, p_slug text)`
- `record_sale { p_product_id, p_quantity }` ↔ `(p_product_id uuid, p_quantity integer)`
- `add_staff_member { p_org, p_email, p_role }` ↔ `(p_org uuid, p_email text, p_role app_role)`
- `sign_my_document { p_doc_id }` ↔ `(p_doc_id uuid)`
- `link_my_member_records ()` ↔ `()`

## Honest limitations (what this audit does NOT claim)

1. **`.select()` reads are now per-table precise** (upgraded after the first pass): each
   selected identifier is checked against its *specific* target table, and embedded
   relations (`alias:table(cols)`) are resolved so their inner columns are checked against
   the embedded table — all resolved, none skipped. The residual "wrong-table collision"
   risk from the first pass is therefore closed for selects and writes. The remaining
   *filter/order* check (`.eq/.in/.order/…`) is still "appears-anywhere," because those
   clauses don't carry an unambiguous inline table in all chains; residual risk low
   (same names, real columns) and flagged rather than hidden (§3.4).
2. **Static only** ~~Says nothing about migrations applying…~~ **→ UPDATE 2026-07-01:**
   all 23 migrations have since been applied + probe-verified against the live DB (28 tables
   / 21 functions persisted, RLS on all 28), so every table & RPC this audit matched now
   provably exists live. Trigger/SECURITY-DEFINER *behavior* is covered by the probes;
   only the 0004 Storage-policy *behavior* (vs. structure) remains unexercised.
3. **Scripts:** `scratchpad/coldrift.mjs`, `writedrift.mjs`, `readdrift.mjs` (session-local,
   not committed).

## Flags raised (severity)

- **[MEDIUM] Constitution audit trail is absent from the tree.** CLAUDE.md cites
  `docs/amendments/AMD-001…AMD-006` and `docs/catastrophic-events/CAT-001-…`, but the
  `docs/` tree contains only `DEVELOPMENT-PLAN.md`. Per §7.3 the amendment folder is the
  *immutable record* and CLAUDE.md is the *derived* state — yet the record it derives from
  is missing. This is itself an instance of the CAT-001 pattern ("methodology store
  outside the tree"). **Not self-remediated:** manufacturing those files now would
  fabricate a ratification history this agent did not witness — a §3.1/§3.4 violation worse
  than the gap. **Founder decision required:** either (a) import the real amendment/CAT
  files from wherever they live into `docs/`, or (b) confirm CLAUDE.md's inline text is the
  authoritative source and the separate files were never created (in which case §7.3 should
  be reconciled to reality). Until resolved, §0.1's "cite only from the tree" rule is
  technically unmet for AMD/CAT labels, even though the *substance* of each rule is present
  verbatim inside CLAUDE.md.

## Follow-on hardening (same audit pass, 2026-07-01) — layer-4 error UX

The outside-view pass also surfaced a cross-cutting layer-4 defect: when a DB **unique
constraint** or the **capacity trigger** rejects a write, the actions redirected with the
raw Postgres `error.message` (e.g. `duplicate key value violates unique constraint "…"`)
— a "confident, well-formed" success path that degrades into gibberish on the (real) race
/ duplicate path. The correctness was always sound (the DB is the invariant); the *surface*
was not. Resolved by translating `unique_violation` (SQLSTATE 23505) to a human message at
every user-facing insert:

- New shared helper `src/lib/pg-errors.ts` (`isUniqueViolation`, SQLSTATE constants) — the
  single home for the code, so it can't drift across modules. `src/lib/checkins.ts` now
  reuses it.
- Translated paths: check-in (3 surfaces: staff / kiosk / member page, each in its own
  voice) · class booking (re-book) · coupon code · product SKU · member number · group
  membership. Capacity overflow already raised a friendly `session is full (capacity N)`.
- Already-safe paths (no change): `add_staff_member` uses `on conflict do update`;
  `qr_token`/PK collisions are random-UUID and not user-reachable.

New feature this pass: staff **Regenerate check-in code** (`rotateCheckInCode`) — the
revocation path for the stable-token model — with a member-page success banner. Signed/
expiring QR remains deliberately deferred (§3.3, product tradeoff — founder's call).

All changes build-green + lint/tsc-clean; **untested against a live DB** (C2) — the
translated messages are proven correct in logic, not yet exercised by a real 23505.

## Outcome

Per §1.7.5 audits produce **flags, not blockers**. The UI↔schema contract is verified
consistent; the one MEDIUM flag is a documentation/governance gap for the founder, not a
build defect. Work continues (A23 flag-and-continue).
