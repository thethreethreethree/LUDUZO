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
- 🚧 **Migrations 0002–0016** authored (members, relationships, documents, billing, POS, check-in,
  classes, payroll, measurements, member portal, loyalty) — each with a matching probe under
  `supabase/tests/`. **UNTESTED** until run (founder choice C2, code-first).
- 🚧 **App** (Next.js 16, App Router) — full staff dashboard + member self-service portal.
  `npm run build` **passes** (types + compile); runtime against live Supabase is **UNTESTED**.

> ⚠️ **Scope of "verified":** only `0001` is proven against the live DB. Everything since **compiles**
> but is not runtime-tested until the migration/probe queue in `docs/DEVELOPMENT-PLAN.md` is run.

## Features (built; compile-verified)
Onboarding (create a gym) · members (search, statuses, notes, QR, documents, subscriptions incl.
freeze/cancel, progress measurements, loyalty, history, CSV export) · locations · groups (family/corporate)
· guest passes · referrals · document templates & signing · membership plans · coupons · invoices · POS
(atomic stock + paid invoice) · QR check-in + kiosk + live occupancy · classes/sessions/bookings with
capacity enforcement & attendance roster · staff directory · payroll/commissions · time clock · inventory
& equipment · announcements · reports · activity (event stream) · white-label settings · member portal.

## Setup / local dev
1. Create a Supabase project; copy keys into `.env` (template: `.env.example`).
2. Apply migrations **in order** `0001` → `0016` from `supabase/migrations/`.
3. After each, run its probe in `supabase/tests/` (expect `OVERALL = ALL PASS`). See the consolidated
   run-queue + dependency notes in `docs/DEVELOPMENT-PLAN.md`.
4. `npm install` then `npm run dev`; open `/` → **Staff dashboard** or **Member portal**.

## Governance note
Migration `0004` includes Supabase Storage policies (not probe-covered — validate manually). Stripe is
**not** integrated (schema reserves `stripe_*` columns); the C3 Stripe-Connect decision is pending.
