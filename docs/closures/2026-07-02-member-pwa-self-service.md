# Closure manifest — Member PWA self-service + audit remediation

**Date:** 2026-07-02
**Scope:** commits `ea3dd2a` → `7e58b2e` (member self-service booking/log/join/phone,
the re-book fix, and audit findings F-A…F-F).

This manifest exists because of finding **F-A (A22 violation)**: constitutional
assets were cited in this session's commit messages and migration headers *before*
the source documents were re-read in-session. A22 requires a session-read manifest
at closure — this is it, produced (belatedly) during the audit the founder
requested.

## Precondition-gate note (§0.1 / AMD-005)
`docs/amendments/` is **empty** — AMD-001…006 files are not in the working tree.
AMD-006's operative text (§1.5.1, §1.5.2) survives only because it is inlined in
`CLAUDE.md`. Flagged to the founder; audited against the inlined text.

## Session-read record

| Asset | Source (in tree?) | Re-read in-session | Cited before re-read? |
|-------|-------------------|--------------------|-----------------------|
| §1.5.1 / §1.5.2 (AMD-006) | CLAUDE.md ✅ | In context from session start | No — in context |
| §3.1, §3.2, §3.3, §3.4, §3.6, §1.6, §2 | CLAUDE.md ✅ | In context from session start | No — in context |
| A5, A12, A13, A14 | ThinkerThinker.md ✅ | **2026-07-02, during audit** | **YES — the F-A violation** |
| A20, A21, A22, A23 | ThinkerThinker.md ✅ | **2026-07-02, during audit** | A23 cited from cached label in prior turns; re-read during audit |

**Honest accounting:** the `§`-clauses were in my context window from session start
(not purely cached memory). The **A-asset citations** (`A5`, `A12` in migration
headers `0034`/`0036`/`0037`/`0038`; `A23` in Build-Stop Decisions) were made from
cached labels — `ThinkerThinker.md` was not opened until the audit. That is the
§A19/§A22 breach. Migration headers `0039`/`0040` (authored after the re-read) note
the in-session read explicitly.

## Embodiment / violation per asset

- **§1.5.1 L2 (does it actually work):** embodied — every write path E2E-verified vs
  a provisioned pure member (book/waitlist/cancel/re-book, log, join, phone, staff
  booking). Untested: browser round-trip (DB path only) — stated, not hidden (§3.4).
- **§1.5.1 L3 (composition):** initially VIOLATED — the re-book fix landed member-only
  (F-B, A21). Remediated: staff `book_member_into_session` (0039) brings parity;
  `gym_staff_directory` (0040) closes the trainer-name composition gap (F-C).
- **§1.5.2 (proactive audit AND adjacent surfaces):** VIOLATED then corrected — the
  in-session proactive audit checked the member surface but not the staff analog
  (A21). This audit checked across; F-B/F-C are the result.
- **§2 (locked doors → better room):** embodied in F-C — did not expose staff PII to
  fix trainer names; built a name-only projection instead.
- **§3.1 (append-only events):** embodied — booking triggers still fire under both
  RPCs (auth.uid() unchanged in definer fns); 0035 added the missing community event.
- **§3.2 (RLS structural):** embodied — member writes scoped by policy (F2), staff RPC
  authorized by org role, verified by explicit deny tests.
- **A20 (don't defer the safe default):** VIOLATED at session end (deferred the
  trainer-name fix that had a safe default) → corrected in F-C.
- **A21 (audit across modules):** the organizing finding — F-B.
- **A22 (session-read manifest):** VIOLATED (no manifest until now) → this file.
- **A23 (flag-and-continue):** honored — did not stop on decision-gated items; kept
  building buildable elements.

## Remediation status (this audit)
F-A ✅ (this manifest) · F-B ✅ verified · F-C ✅ verified · F-D ✅ (via F-B) ·
F-E ✅ · F-F ✅.
