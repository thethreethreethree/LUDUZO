# LUDUZO — Phase-Structured Development Plan

> Governed by `CLAUDE.md` (constitution) and `ThinkerThinker.md` (asset library), both in the repo root.
> AMD-006 lives in `CLAUDE.md` as §1.5.1 + §1.5.2 (not a separate file).
> Build order obeys CLAUDE.md **§1.5.1** (four-layer, foundation-up) and **§1.7** (ground-up).
> Each phase must pass the four-layer sieve before the next begins.
> Verification mode: **code-first / untested** (founder choice C2) — nothing is marked "working" until run against a live backend.
>
> Status markers: ✅ done · 🚧 in progress · ⬜ not started.

## Product
**LUDUZO** — a multi-tenant SaaS for gym management. A tenant = a gym business (one or more locations);
the platform serves many gyms. No single dogfood tenant (Gymlang removed by founder) — see "Open tensions."

## Stack (confirmed)
- **Next.js (App Router) on Vercel** · **Supabase** (Postgres / Auth / RLS / Storage / Realtime) · **GitHub**
- **Stripe** (payments) · **Resend/Postmark + Twilio** (email/SMS) · **Inngest** or `pg_cron` (jobs)
- **shadcn/ui + Tailwind** (themeable UI / white-label) · **PostHog + Sentry** (analytics + errors)

## Data architecture (C4 = Hybrid)
Conventional relational tables for current entity state **+** an append-only, immutable `events` stream
(**CLAUDE.md §3.1**) for lifecycle / audit / analytics. State tables are the source of "now"; `events` is the
source of "what happened," and is **never updated or deleted** (enforced by DB trigger).

## Phases
### Phase 1 — Foundation 🚧 (DB foundation verified; app layer pending)
Multi-tenancy (`organizations` → `locations`), identity (`profiles` ↔ `auth.users`), RBAC
(`organization_members` + `app_role`), RLS tenant isolation, append-only `events` stream.
- **Clauses:** §0, §1.5.1 layer 1 (data shape), §1.7 (ground-up), §3.1 (append-only events), A12 (idempotent
  migrations), A5 (tenancy decided up front — expensive to retrofit).
- **Exit gate (four-layer):** structure sound · RLS *verified* to isolate tenants · composes with every later
  phase · (no UI yet — layer 4 N/A this phase).
- **Exit-gate status (2026-06-29):** DB foundation **VERIFIED** against live Supabase — **23/23** checks
  (tenant isolation · role-gating on every writable table · `anon` denial · suspended-access revocation ·
  append-only `events`) pass via `supabase/tests/0001_foundation_rls_verify.sql`. App layer (Next.js
  scaffold + Supabase client) **not yet built** — that is the remaining Phase-1 work.

### Phase 2 — Member Management 🚧 (data layer authored; member-core UI built)
Member profiles & statuses, search, member-lifecycle events, waivers/contracts (Storage + digital signature),
family/group/corporate links, guest passes & referral tracking.
- **Built (UNTESTED until migrations/probes are run):**
  - `0002_members.sql` — `create_organization()` onboarding fn · `members` table · append-only member
    lifecycle events · RLS. Probe: `tests/0002_members_rls_verify.sql`.
  - `0003_relationships_guests_referrals.sql` — `member_groups` + links (family/corporate) · `guest_passes`
    · `referrals` · RLS. Probe: `tests/0003_relationships_rls_verify.sql`.
  - `0004_documents.sql` — `document_templates` · `member_documents` + sign events · private Storage bucket
    + policies (⚠ storage policies not probe-covered). Probe: `tests/0004_documents_rls_verify.sql`.
  - **App (compiles):** `/onboarding` (create gym) · `/dashboard/members` (list + search) ·
    `/dashboard/members/new` · `/dashboard/members/[id]` (status + lifecycle history).
- **Also built (compiles):** UI for locations, groups, guest passes, referrals, document templates +
  per-member document assign/sign, and dashboard navigation to all of them.
- **Member self-sign:** ✅ built (0020 `sign_my_document()` + portal Sign button).
- **Staff management:** ✅ add/update staff by email for existing accounts (0021 `add_staff_member()` +
  Team page form). **Still flagged:** email-invite for people without an account (needs email provider + decision).

### Phase 3 — Membership plans & billing 🚧 (billing-core schema + plans/subscriptions UI built)
Plans/tiers (monthly, annual, day-pass, freeze/hold), Stripe subscriptions, proration, dunning/auto-suspension,
invoices/receipts/refunds, POS, discounts/coupons/gift cards. **(C3 Stripe Connect decision resolved here.)**
- **Built (UNTESTED until run):** `0005_billing.sql` — `plans`, `subscriptions`, `invoices` + append-only
  subscription/invoice events + RLS (plans=mgmt write; subs/invoices=staff write). Probe:
  `tests/0005_billing_rls_verify.sql`. App: `/dashboard/plans` (list + create); per-member plan assignment
  on the member page.
- **Pending / FLAGGED (needs your input):** Stripe integration + keys; the **C3 Stripe-Connect** decision;
  proration, dunning/auto-suspension, refunds, POS, coupons/gift cards; invoices UI. `stripe_*` columns are
  reserved but unused.

### Phase 4 — QR check-in & occupancy 🚧 (built; UNTESTED until run)
Signed member QR, kiosk scan, attendance events, real-time headcount/occupancy (Supabase Realtime),
capacity limits.
- **Built:** `0006_checkins.sql` — `members.qr_token` + `checkins` (+ checkin/checkout events) + RLS.
  Probe: `tests/0006_checkins_rls_verify.sql`. App: `/dashboard/checkins` (live occupancy, check-in by
  member or QR token, check-out); member QR token shown on the member page.
- **Built (2026-07-01):** staff **"Regenerate" check-in code** on the member page
  (`rotateCheckInCode`) — the revocation path for the stable-token model: a photographed
  or lost code can now be invalidated on demand (old token stops matching immediately).
  UNTESTED against live DB. Added an `ok` success banner to the member page (layer-3
  confirmation).
- **Flagged (still deferred by design):** signed/expiring QR (HMAC rolling codes) is a
  *different security model* (verify `HMAC(secret, member_id, window)` instead of matching
  a stored token) with a real product tradeoff (rolling codes need the member's app open at
  scan time vs. a printable stable card) — deliberately **not** built unprompted (§3.3
  guide-don't-overtake). Realtime occupancy push also future hardening (on-load count for
  now). The new Regenerate action closes the concrete residual risk (non-revocable token)
  *within* the current model, without pre-empting the founder's signed-QR decision.

> **Phases 1–4 = the core-loop MVP.** Each later phase is its own four-layer-gated sub-plan.

### Phase 5+ — Long tail 🚧 (scheduling/bookings + team/activity started)
Scheduling & bookings · Trainer/staff ops & payroll/commission · Engagement & retention (member app, progress
tracking, wearables, gamification, loyalty, churn prediction) · Communication & marketing (CRM, campaigns,
community, NPS) · Inventory & equipment · Analytics & reporting · Platform/admin SaaS-essentials (multi-location/
franchise, white-label, SaaS-self billing & tiers, audit logs, open API/webhooks, GDPR/consent, backups,
i18n/multi-currency) · Optional differentiators (AI workout/diet, streaming, nutrition, IoT/smart-lock, kiosk).
- **Built (UNTESTED until run):** `0007_classes_bookings.sql` (classes/sessions/bookings + events + RLS).
  Probe: `tests/0007_classes_bookings_rls_verify.sql`. App: `/dashboard/classes` (classes, sessions, bookings),
  `/dashboard/staff` (team directory, read), `/dashboard/activity` (the append-only event stream — §3.6).
- **Flagged:** trainer-entity link, member self-booking, staff invites — need decisions.

## ✅ DB VERIFIED AGAINST LIVE SUPABASE — 2026-07-01
All **23** migrations are now applied and probe-verified against the live database
(project `tgloodwvvwcxdibmchyq`). 0001 was verified 2026-06-29 (23/23); 0002–0023 were
applied in dependency order on 2026-07-01, each probe returning `OVERALL | ALL PASS` at its
exact expected count (10·7·7·7·8·6·5·5·5·5·3·5·4·6·5·4·2·2·2·3·2·2). Post-flight confirms
**28 public tables + 21 functions persisted, RLS enabled on all 28 tables (none
unprotected)**, and the `member-documents` Storage bucket + its two `storage.objects`
policies (`member_docs_storage_read` SELECT, `member_docs_storage_write` ALL) exist.
**Remaining caveat:** the Storage policies are verified *structurally* (they exist) but not
*behaviorally* — a live upload/read as a staff user vs. a foreign-tenant user is still
needed to prove they admit/deny correctly (needs two authenticated test users).

## Consolidated run-queue (apply migration, then its probe; expect OVERALL = ALL PASS)
0002 → tests/0002 (10) · 0003 → tests/0003 (7) · 0004 → tests/0004 (7) + manual storage check ·
0005 → tests/0005 (7) · 0006 → tests/0006 (8) · 0007 → tests/0007 (6) · 0008 → tests/0008 (5) ·
0009 → tests/0009 (5) · 0010 → tests/0010 (5) · 0011 → tests/0011 (5) · 0012 → tests/0012 (3) ·
0013 → tests/0013 (5) · 0014 → tests/0014 (4) · 0015 → tests/0015 (6) · 0016 → tests/0016 (5) · 0017 → tests/0017 (4) · 0018 → tests/0018 (2) · 0019 → tests/0019 (2) ·
0020 → tests/0020 (2) · 0021 → tests/0021 (3) · 0022 → tests/0022 (2) · 0023 → tests/0023 (2).
0001 already verified (23/23).

## Brand / design (AMD-006 layer 4 — APPLIED)
Applied the LUDUZO brand from `DESIGN ELEMENTS/design assets` (source: `luduzo-tokens.css`, README,
mockups). **Dark-first** theme (Gladiator Black `#0A0A0A` + Plume Gold `#FECE00`), **Montserrat** (display)
+ **Inter** (body), gladiator-helmet logo, brand favicon + OG image. Whole app forced to the dark variant;
31 primary CTAs swept to gold; helmet logo in landing/nav/login; landing rebuilt to the mockup.
Verified in the build output (gold utilities + fonts in the compiled CSS; `class="dark"` + helmet + arena
in the prerendered HTML). **Pixel-level visual is founder-to-confirm** (`npm run dev`). Assets live in
`public/` + `public/brand/`.
(0011 needs 0005+0008; 0012 needs 0007; 0015 needs 0005+0014; 0016 needs 0015; 0018 needs 0006;
 0019 needs 0009+0015; 0020 needs 0004+0015.)

## Flags awaiting founder decision (surfaced 2026-07-01, outside-view audit)
- **[MEDIUM] POS overselling — silent negative stock.** `record_sale` (0011) does
  `stock_quantity = stock_quantity - p_quantity` with **no guard**, and `products`
  (0008) has **no `check (stock_quantity >= 0)`** (note: `price_cents` right beside it
  *does* have `>= 0`, so the asymmetry is a smell). Selling more units than are in stock
  therefore succeeds silently and drives stock negative — reads like a bug at the register.
  **Not self-fixed:** the correct behavior is a product choice, so any change here *is* the
  decision (§3.3 guide-don't-overtake). Options: **(a) block** — add
  `check (stock_quantity >= 0)` + a friendly "insufficient stock" message (safest for
  inventory accuracy; but blocks a sale when the count is merely wrong); **(b) allow +
  warn** — permit the sale, surface a "stock is negative, reconcile" indicator
  (register-friendly, keeps accuracy visible); **(c) allow silently** (current). Recommend
  **(b)**. Founder to choose.
- **[LOW] `member.qr_rotated` not audited.** The new Regenerate-code action is a
  security-relevant event but isn't on the `events` stream (the members UPDATE trigger only
  emits on status change). Adding a dedicated event needs events-insert RLS verified first.

## Open tensions (surfaced, not silently resolved)
- **§3.4 (Honesty Is the Moat):** with Gymlang removed there is no real first tenant to dogfood;
  multi-tenant-from-day-1 carries the §3.4 risk of building for hypothetical customers.
  **Accepted per founder direction** — re-flag when a first real gym is onboarded.
- **C3 two-layer billing (Stripe Connect):** deferred to Phase 3; `organizations` reserves space for it.
- **Verification:** founder chose code-first. **DB layer now live-verified** (all 23
  migrations applied + probes ALL PASS, 2026-07-01). The **app layer** (Next.js server
  actions / pages) is still untested end-to-end against the live DB — build-green and
  schema-contract-verified (AUDIT-001), but not exercised by a real request/round-trip.
