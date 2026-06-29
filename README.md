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

## Status — Phase 1: Foundation (in progress)
Multi-tenancy, identity, RBAC, RLS isolation, append-only events.

> ⚠️ **UNTESTED.** Per founder choice (code-first), the SQL and config in this repo have **not** been run
> against a live Supabase instance. Nothing here is confirmed working until verified.

## Setup (planned — not yet verified)
1. Create a Supabase project; copy keys into `.env` (template: `.env.example`).
2. Apply `supabase/migrations/0001_foundation.sql`.
3. Verify RLS tenant isolation (next step), then scaffold the Next.js app and wire the Supabase client.
