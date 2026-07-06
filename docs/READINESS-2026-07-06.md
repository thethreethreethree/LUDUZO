# Market-readiness assessment — 2026-07-06

- **Stance:** Outside-view (§1.3), grounded in the codebase, not memory. Every load-bearing
  claim below was checked against `src/` or the live DB the day of writing.
- **Discipline:** No fabricated precision (§5). The percentage counts only operational
  locks/bottlenecks.

## Ratified definition (founder, 2026-07-06)

> "Market ready" = **a gym owner can fully operate their gym end-to-end.** The percentage
> counts **only operational locks/bottlenecks** — elements that would *stop* an owner from
> running the gym. Explicitly **excluded from the %**:
> - **Online payment processing (Stripe/C3).** Gyms take cash / manual payment today; a
>   processor is a later addition, not an operating blocker.
> - **Non-operational polish** (accessibility, cosmetic gaps, enhancements). Real, tracked
>   below, but they don't stop a gym from operating, so they don't gate the number.

---

## Operational readiness: ~90% — and no known hard blocker

A gym owner can operate today. Every make-or-break operational flow is built and verified;
what keeps this from a *confident* 100% is real-use proof and a few minor edges, **not
missing features.**

### Core operational flows — verified present & sound
| Flow | Status | Evidence |
|---|---|---|
| Create a gym (onboarding) | ✅ | `onboarding/` |
| Add / edit / check in members | ✅ | `members/*`, `checkins`, race-safe (0018) |
| **Member portal access** | ✅ | self-signup → claim by email (`link_my_member_records`, 0015) |
| **Staff onboarding** | ✅ | `add_staff_member` (0021); staffer signs up first, owner adds by email |
| Classes + member booking | ✅ | `classes`, `portal/book` |
| POS + inventory (cash sale) | ✅ | `record_sale` RPC (0011) — integer cents, atomic stock |
| Cash/manual invoicing | ✅ | `invoices` — create/mark-paid/void, integer cents |
| Member self-service PWA | ✅ | pass, booking, progress, referrals, feedback |
| Tenant isolation | ✅ | RLS 62/62 tables, 14/14 probes pass live |

### Why not 100% (the honest residual — all non-feature)
1. **Real-use end-to-end proof** (largest slice). Flows are traced in code + structurally
   verified (RLS, money math, access); no *design-partner gym has run a week of real
   operations*. That's missing **proof**, not a missing feature.
2. **Minor operational edges** (work, small friction): a staffer must self-sign-up before
   an owner can add them (clear message, not a lock); webhook *delivery* is a scaffold
   (registration works; delivery needs a job runner — irrelevant to running a gym).
3. **`0057` (trainer bios)** not yet applied — the UI degrades gracefully, so not a
   blocker; founder-apply when convenient.

### Only one "not implemented" marker exists in the whole app
`admin/page.tsx` — webhook event delivery (scaffold). Nothing in the daily
operating path is stubbed.

---

## Explicitly excluded from the % (real, but not operating blockers)
- **Online payments (Stripe/C3).** Founder-deferred; cash works. When built: the C3
  Stripe-Connect decision, then dues/invoice/POS card flows + an external security review.
- **Accessibility polish.** Member portal forms are labelled; the staff dashboard sweep is
  underway (`classes`, `gamification`, `programs`, `inventory`, `maintenance`, `leads`,
  `feedback`, `resources` done). ~19 lower-traffic pages remain — quality, not a blocker.
- **Transactional email** (receipts/reminders). In-app + Supabase auth email cover the
  operating path; app-level email is an enhancement.

---

## Resolved since first draft
- **M1 (admin branding trap) — FIXED.** The Admin page's `brand_color`/`accent_color`/
  `logo_url` inputs wrote top-level columns the member app never read (it reads the
  `settings` jsonb, written by the **Settings** page). An owner setting a logo in Admin saw
  it silently vanish — a broken owner workflow. The dead inputs + their writes were removed
  and Admin now points to Settings. (Harmless unused columns left in place; dropping them
  is a founder-gated migration, not needed.)

## Open decisions
0. **Restore `docs/amendments/`** — the entire amendments directory (AMD-001…006) is
   absent from the tree, though CLAUDE.md cites them and their ratified text (e.g. §1.5.1/
   §1.5.2) lives in CLAUDE.md. Two stray duplicate copies of the constitution (`THINKX1.md`,
   `THINKX2.md`) also sit at repo root. Surfaced 2026-07-07 during the theme build; the
   founder authorized proceeding under the in-tree ratified text. Restore the amendment
   docs so AMD-006 etc. can be quoted from source (§0.1/A19).
1. **`0057` apply** (trainer bios) — verified apply-ready.
2. **PWA device check** — reinstall to confirm the rasterized gym icon holds.
3. **When to start payments** (Stripe/C3) — deferred by founder; picked up later.
4. **Finish the dashboard a11y sweep?** (quality, ~19 pages left) — founder's call.

*Recorded per §1.7 (assessments on the record) and §3.1 (data-as-asset). The number is
honest and grounded; no operating blocker omitted to flatter it, none invented to justify
work.*
