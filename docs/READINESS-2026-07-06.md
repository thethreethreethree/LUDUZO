# Market-readiness assessment — 2026-07-06

- **Stance:** Outside-view (§1.3), grounded in the codebase, not memory. Every load-bearing
  claim below was checked against `src/` or the live DB the day of writing.
- **Discipline:** No single fabricated percentage (§5). Readiness is decomposed by *what is
  being shipped*, because one number would hide the gap that matters most (payments).

---

## The one-number trap

"What's our readiness %" has no honest single answer — it depends entirely on the target.
Three targets, three very different numbers:

| Target | Readiness | Gating gaps |
|---|---|---|
| **Design-partner soft launch** — a few gyms who accept *manual* billing | **~70–75%** | PWA on-device sign-off, `0057` apply, M1 decision, no E2E tests |
| **Broad self-serve launch** — any gym signs up and pays | **~45–55%** | **No automated payments**, no transactional email, no external security audit, no proven real-customer run |
| **The differentiated "System"** — the events→signals→problems→resolutions diagnostic AI (CLAUDE.md §3–4) | **~15–25%** | The diagnostic engine is not built; the schema/method discipline exists, the product does not |

These are grounded estimates with stated reasoning — not precision defensible to a decimal.

## Evidence (checked 2026-07-06)
- **Payments:** `grep` for `new Stripe` / `stripe.(checkout|paymentIntents|subscriptions|customers)`
  → **0 files.** Billing is record-only/manual; schema reserves `stripe_*` columns, nothing
  consumes them.
- **Transactional email/SMS:** `grep` for resend/sendgrid/nodemailer/postmark/mailgun/smtp
  → **0 files.** Receipts, invoice reminders, referral emails do not send. In-app + Supabase
  Auth login emails only.
- **The "System":** no `signals` / `resolutions` / `diagnos*` product surface in `src/app`.
  What ships today is the gym-management SaaS, not the diagnostic thesis product.
- **Tenant isolation:** RLS on **62/62** tables; **14/14** RLS probes pass against the live DB
  (AUDIT-002). The hardest-to-retrofit property is done.

## Genuinely strong (verified, not asserted)
- Multi-tenant isolation (above) — the core moat.
- Broad surface: ≈45 dashboard segments + full member PWA (membership, QR pass, booking,
  progress, referrals, feedback, community, notifications).
- Per-gym white-label branding (colours, logo, PWA icon), integer-cents money integrity,
  complete error-boundary net (dashboard + portal + root), honest pure-logic tests
  (48 assertions), portal form a11y.

## Gaps that cap the number — in priority order
1. **Payments (biggest).** "Collect dues automatically" is table-stakes for most gyms.
   Manual-only billing suits a handful of design partners; it's a dealbreaker for a broad
   launch. This alone caps the middle row at ~55%. **Decision required: C3 — Stripe Connect
   (docs note it pending).**
2. **Transactional email.** Receipts/reminders don't leave the system.
3. **No proof under real conditions** — no E2E/integration tests, no external security
   audit, no confirmed paying-customer deployment. (Prod is live and green; real usage is
   unverified — not claimed.)
4. **The thesis product** — if "market" means the diagnostic System, that is the real gap,
   and it's a product-direction decision, not a polish pass.

## Punch-lists

### To design-partner soft launch (top row — achievable, Stripe deferred)
- [ ] Founder: reinstall PWA on-device, confirm the rasterized gym icon holds.
- [ ] Founder: apply `0057` (trainer bios; verified apply-ready).
- [ ] Founder decision: M1 — dedup the admin-vs-settings branding trap.
- [ ] Add a minimal happy-path E2E smoke (member claim → check-in → book) — currently only
      pure logic is unit-tested.
- [ ] Written manual-billing runbook for partner gyms (what the gym does without Stripe).

### To broad self-serve launch (middle row — Stripe is the gate)
- [ ] **C3 decision + build: Stripe Connect** (per-gym payouts) — dues, invoices, POS.
- [ ] Transactional email (receipts, invoice reminders, referral touch).
- [ ] External security review / pen test before taking card data flows live.
- [ ] Load/soak test on the busiest paths (check-in, booking).

## Open decisions this assessment surfaces
1. **Which target are we actually building toward?** (materially changes priorities)
2. **C3 — Stripe Connect** (the payments gate).
3. Whether/when to build the diagnostic **System** vs. harden the SaaS.
4. Carried from AUDIT-002: M1, `0057`, PWA device check, `next@16.2.10` (S3).

*Recorded per §1.7 (assessments on the record) and §3.1 (data-as-asset). Estimates are
honest and grounded; no gap omitted to flatter the number.*
