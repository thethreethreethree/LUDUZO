# LUDUZO

A **multi-tenant SaaS for gym management**. A tenant is a gym business (one or more locations); the
platform serves many gyms.

## Governance
This build is governed **strictly** by:
- **`CLAUDE.md`** — the operating constitution (AMD-006 lives here, as §1.5.1 + §1.5.2).
- **`ThinkerThinker.md`** — the methodology asset library (A1–A23).

See **`docs/DEVELOPMENT-PLAN.md`** for the phase-structured roadmap.

## Stack
Next.js (App Router) · Vercel · Supabase (Postgres / Auth / RLS / Storage / Realtime) · Stripe · GitHub.

## Data architecture
**Hybrid** (founder choice C4): conventional relational tables for current entity state **+** an
append-only, immutable `events` stream (CLAUDE.md §3.1) for lifecycle / audit / analytics.

## Status
- ✅ **Foundation VERIFIED** against live Supabase — `0001_foundation.sql`, 23/23 checks
  (`supabase/tests/0001_foundation_rls_verify.sql`), applied 2026-06-29.
- 🚧 **Migrations 0002–0061** authored (members, relationships, documents, billing, POS, check-in,
  classes, payroll, measurements, member portal, loyalty, engagement, scheduling, platform-admin,
  sales/CRM, notifications, workout logs, aggregate views, brand storage, …) — early ones under
  founder choice C2 (code-first). **`0057–0061` are applied + verified against the live DB** (2026-07);
  `0057` (trainer bios) is authored + apply-verified but **not yet applied**.
- 🚧 **App** (Next.js 16, App Router) — full staff dashboard + member self-service portal.
  `npm run build` **passes**; critical pure logic has unit tests (`npm test`) and the PWA icon has a
  smoke test (`npm run smoke:pwa`). Full runtime against live Supabase remains partial (C2).

> ⚠️ **Scope of "verified":** `0001` and the 2026-07 branding/PWA migrations (`0057–0061`) are proven
> against the live DB; the middle range (`0017–0056`) is applied per the founder's run-queue. See
> `docs/audits/` for the recorded audits.

## Features (built; compile-verified)
Onboarding (create a gym) · members (search, statuses, notes, QR, documents, subscriptions incl.
freeze/cancel, progress measurements, loyalty, history, CSV export) · locations · groups (family/corporate)
· guest passes · referrals · document templates & signing · membership plans · coupons · invoices · POS
(atomic stock + paid invoice) · QR check-in + kiosk + live occupancy · classes/sessions/bookings with
capacity enforcement & attendance roster · staff directory · payroll/commissions · time clock · inventory
& equipment · announcements · reports · activity (event stream) · white-label settings · member portal.

## Setup / local dev
1. Create a Supabase project; copy keys into `.env` (template: `.env.example`).
2. Apply migrations **in order** `0001` → `0061` from `supabase/migrations/`.
3. After each, run its probe in `supabase/tests/` (expect `OVERALL = ALL PASS`). See the consolidated
   run-queue + dependency notes in `docs/DEVELOPMENT-PLAN.md`.
4. `npm install` then `npm run dev`; open `/` → **Staff dashboard** or **Member portal**.

## Quality checks
- `npm run lint` — ESLint (expect 0 problems).
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` — dependency-free unit tests for critical pure logic: per-gym theming
  contrast math (`scripts/gymTheme.test.mjs`) and money formatting
  (`scripts/billing.test.mjs`). Runs on Node 22+ via `--experimental-strip-types`
  (covers self-contained modules; anything importing the `@/` alias needs a test
  framework with tsconfig-paths, not yet added).
- `npm run smoke:pwa [baseUrl] [supabaseLogoUrl]` — post-deploy smoke test of the PWA
  manifest + generated app icon (SSRF guard, PNG icons, optional real-logo rasterize).
  Defaults to the production URL.

## Governance note
Migration `0004` includes Supabase Storage policies (not probe-covered — validate manually). Stripe is
**not** integrated (schema reserves `stripe_*` columns); the C3 Stripe-Connect decision is pending.
