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

### Phase 2 — Member Management ⬜
Member profiles & statuses, search, member-lifecycle events, waivers/contracts (Storage + digital signature),
family/group/corporate links, guest passes & referral tracking.

### Phase 3 — Membership plans & billing ⬜
Plans/tiers (monthly, annual, day-pass, freeze/hold), Stripe subscriptions, proration, dunning/auto-suspension,
invoices/receipts/refunds, POS, discounts/coupons/gift cards. **(C3 Stripe Connect decision resolved here.)**

### Phase 4 — QR check-in & occupancy ⬜
Signed member QR, kiosk scan, attendance events, real-time headcount/occupancy (Supabase Realtime),
capacity limits.

> **Phases 1–4 = the core-loop MVP.** Each later phase is its own four-layer-gated sub-plan.

### Phase 5+ — Long tail ⬜
Scheduling & bookings · Trainer/staff ops & payroll/commission · Engagement & retention (member app, progress
tracking, wearables, gamification, loyalty, churn prediction) · Communication & marketing (CRM, campaigns,
community, NPS) · Inventory & equipment · Analytics & reporting · Platform/admin SaaS-essentials (multi-location/
franchise, white-label, SaaS-self billing & tiers, audit logs, open API/webhooks, GDPR/consent, backups,
i18n/multi-currency) · Optional differentiators (AI workout/diet, streaming, nutrition, IoT/smart-lock, kiosk).

## Open tensions (surfaced, not silently resolved)
- **§3.4 (Honesty Is the Moat):** with Gymlang removed there is no real first tenant to dogfood;
  multi-tenant-from-day-1 carries the §3.4 risk of building for hypothetical customers.
  **Accepted per founder direction** — re-flag when a first real gym is onboarded.
- **C3 two-layer billing (Stripe Connect):** deferred to Phase 3; `organizations` reserves space for it.
- **Verification:** founder chose code-first; all artifacts are **untested** until run against a live Supabase.
