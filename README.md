# LUDUZO

A **multi-tenant SaaS for gym management**. A tenant is a gym business (one or more locations); the
platform serves many gyms.

## Governance
This build is governed **strictly** by:
- **`CLAUDE.md`** — the operating constitution (AMD-006 lives here, as §1.5.1 + §1.5.2).
- **`ThinkerThinker.md`** — the methodology asset library (A1–A22).

See **`docs/DEVELOPMENT-PLAN.md`** for the phase-structured roadmap.

## Stack
Next.js (App Router) · Vercel · Supabase (Postgres / Auth / RLS / Storage / Realtime) · Stripe · GitHub.

## Data architecture
**Hybrid** (founder choice C4): conventional relational tables for current entity state **+** an
append-only, immutable `events` stream (CLAUDE.md §3.1) for lifecycle / audit / analytics.

## Status — Phase 1: Foundation
Multi-tenancy, identity, RBAC, RLS isolation, append-only events.

- ✅ `supabase/migrations/0001_foundation.sql` **applied** to live Supabase (founder, 2026-06-29).
- ✅ Tenant isolation, role-gating on every writable table, `anon` denial, suspended-access revocation,
  and append-only `events` **VERIFIED** against the live DB — **23/23** checks pass via
  `supabase/tests/0001_foundation_rls_verify.sql` (2026-06-29).
- 🚧 App layer **scaffolded** — Next.js 16 (App Router) + Supabase SSR auth (login / signup / logout) +
  `proxy` session refresh + protected `/dashboard` that reads the signed-in user's org via RLS.
  `npm run build` **passes** (types + compile).

> ⚠️ **Scope of "verified":** (1) the database foundation — proven against the live DB (23/23);
> (2) the app — **compiles only**. Runtime against live Supabase (sign-in, session, RLS-through-the-app)
> is **UNTESTED** until run with a populated `.env` (founder choice C2, code-first).

## Setup
1. Create a Supabase project; copy keys into `.env` (template: `.env.example`).
2. Apply `supabase/migrations/0001_foundation.sql`.
3. (Optional re-check) Run `supabase/tests/0001_foundation_rls_verify.sql`; expect 23/23 + `ALL PASS`.
4. Scaffold the Next.js app and wire the Supabase client (next).
