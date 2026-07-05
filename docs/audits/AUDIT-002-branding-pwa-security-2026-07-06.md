# AUDIT-002 — Per-gym branding, PWA icon, and security sweep

- **Date:** 2026-07-06
- **Stance:** Outside-view (§1.3) — read the recent build as if someone else wrote it.
- **Layers (AMD-006):** L1 structure · L2 effectivity ("does it work end-to-end") ·
  L3 composition · **security/§3.2 RLS**.
- **Method:** Ground-up audit (§1.7) of the branding/PWA build + a proactive security
  sweep (§1.5.2) of the surfaces it touched (public routes, storage, credential tables).
- **Verification mode:** STRONGER than C2 — the live DB host and the deployed app were
  reachable, so findings marked ✅ were verified against production / the live schema,
  not just reasoned.

## Scope
The 2026-07-03→06 build: per-gym colour theming, logo upload + dedicated PWA-icon
upload, dynamic PWA manifest + generated app icon, receipt/calendar white-label, the
autonomous-build guard, and migrations 0057–0061.

---

## Findings

### OPEN — needs a founder decision

**M1 · Admin-page branding is a silent trap (never reaches members).** MEDIUM · L2/A21.
`dashboard/admin/page.tsx:62-68` exposes `brand_color`/`accent_color`/`logo_url` inputs;
`admin/actions.ts:37` writes them to **top-level columns** (`organizations.brand_color`
…). The member app reads branding only from the **`settings` jsonb**
(`brand_primary`/`settings.logo_url`); a grep confirms nothing reads the columns except
the admin page redisplaying its own inputs. So a logo/colour set via **Admin** saves
without error but **never appears in the member app**. Two branding UIs, one read path.
- *Recommendation:* the **Settings** page is the canonical, complete, verified branding
  surface (3 colours + logo + dedicated PWA icon). Remove the `brand_color`/
  `accent_color`/`logo_url` inputs from the Admin page (keep plan/currency/locale/
  API-keys/webhooks/contact there). Small, safe edit — held pending founder decision
  (§3.3: don't silently remove owner-facing admin UI).

### OPEN — dependency vuln (low risk; safe fix identified)

**S3 · `postcss <8.5.10` XSS via Next's bundled copy.** MODERATE advisory · LOW practical.
`npm audit` flags 2 moderate vulns: Next `16.2.9` bundles `postcss@8.4.31` (XSS via
unescaped `</style>` in CSS stringify, GHSA-qx2v-qp2m-jg93). **Practical exploitability
here is negligible** — postcss runs at BUILD time on dev-authored Tailwind CSS; no
user-controlled CSS is stringified. (The project's own `@tailwindcss/postcss` is already
on patched `8.5.15`; only Next's transitive copy is old.)
- ⛔ **DO NOT run `npm audit fix --force`** — it installs `next@9.3.3`, a catastrophic
  Next 16→9 downgrade that would destroy the app.
- ✅ **Safe fix (founder call — Next is pinned `16.2.9` exactly):** `npm install
  next@16.2.10` (a patch release; likely bumps the bundled postcss), then `npm run build`
  + `npm test` to verify. Held rather than bumping the pinned framework unattended, given
  the negligible risk.

### CLOSED — not a current defect (A15), with a forward note

**L1 · `api_keys.token` stored in plaintext.** LOW · scaffold. `0030` stores the full
token; the migration comment marks it a scaffold, and **no code validates/consumes an
API key anywhere** (no auth path uses it). RLS on `api_keys` (and `webhooks`) is ✅
verified **owner/admin-only** (no member policy), so plaintext is contained to the org's
own admins — no cross-tenant or member leak. *Forward note:* hash the token when
API-key auth is actually built.

### FIXED this session (verified)

| ID | Issue | Fix | Verified |
|---|---|---|---|
| F1 | Single text colour broke on a mismatched light/dark palette; preview hid it | Per-surface text (`bg` vs `card`) + honest preview (`gymTheme.textColors`) | ✅ logic + build |
| S1 | `/portal/icon` fetched any `https` URL server-side (SSRF) | Pinned `logo` to this project's Supabase public-storage prefix | ✅ prod: foreign URL 404s, gym logo renders |
| S2 | Public-route exemption used `startsWith` (future over-exposure) | Exact-match `/portal/manifest` + `/portal/icon` | ✅ build |
| P1 | SVG logos rejected as installed PWA icons → reverted to LUDUZO | Rasterize all logos to a real 192/512 PNG via `/portal/icon` | ✅ prod: gym's real SVG → 512×512 PNG; manifest serves PNG icons |

## Supply-chain + schema-wide security sweep (2026-07-06)
- **RLS coverage:** all **62/62** public tables have RLS **enabled + ≥1 policy** — zero
  open tables, zero accidental deny-all. The §3.2 tenancy invariant holds across the
  whole schema. ✅
- **Secret hygiene:** tracked files scanned — no hardcoded keys/tokens/passwords/private
  keys; `.env` confirmed untracked (gitignored). ✅
- **Dependencies:** `npm audit` → S3 above (moderate, low practical risk, safe fix noted).

## Live-DB verification performed
- Migrations applied + correct: `0058` (redeem_reward member lock + execute grant),
  `0059` (both aggregate views), `0060` (locker_rentals), `0061` (brand bucket, public).
- `0057` (trainer bios) **not yet applied** — re-confirmed apply-clean in a rolled-back
  transaction (as is `0060`).
- Gym "Gymlang" branding stored correctly: header `logo-*.svg`, dedicated PWA icon
  `pwa-*.svg`, palette all-dark (F1 edge not hit).
- Project lint: **0 problems**; typecheck + production build green.

### Billing write-path spot check — clean / scaffold (no active defect)
- **POS `recordSale`** → delegates to the `record_sale` RPC (0011): integer-cents math,
  atomic stock-decrement + paid invoice, quantity clamped `≥1`. **Clean** — no JS float
  money math.
- **Coupons** → `createCoupon` doesn't clamp `percent` to ≤100, BUT: negatives are blocked
  by the DB `check (discount_value >= 0)` (0010:22), and coupon **application is not
  implemented** (0010:4 flags it; no code applies a discount to any invoice). So the
  `percent > 100` gap is **inert** (scaffold). *Forward note:* when redemption is built,
  clamp `percent ≤ 100` and `max(0, total − discount)`.

### Guest passes — staff-managed, LOW (no guest-exploitable path)
`issueGuestPass` / `updateGuestPassStatus` are **staff actions** (front desk issues +
manually marks `redeemed`). No guest self-service redemption exists (0003 flags
enforcement as not-built). `updateGuestPassStatus` doesn't guard double-redemption or
expiry, but it's staff-gated and `status` is DB-enum-constrained — no data corruption,
no unauthenticated access. *Forward note:* add a status/expiry guard if/when guest
self-redemption is built.

### Invoices / refunds / subscriptions / check-in / referrals — clean
- **Invoices:** integer-cents; `createInvoice` requires a positive amount; `markPaid`/
  `void` are staff-gated status changes. **Refunds:** `check (amount_cents >= 0)` (0027)
  blocks negatives at the DB (app-side gap is only raw-vs-friendly error text). Clean.
- **Subscriptions:** fixed — `/more` showed a **negative "days left"** for an `active`
  plan past `current_period_end` (no auto-expiry job); now shows "Expired". (Home/pass
  still gate on `status === "active"` only — display-only, gym manages billing manually.)
- **Check-in:** RLS-scoped to the staff's gym; double check-in blocked by an app guard
  **and** a DB unique constraint (`uq_checkins_open_member`, 0018) — race-safe; checkout
  idempotent. **Referrals:** `referrer_member_id` = the authenticated member (RLS 0049);
  no auto-reward, so self/duplicate are staff-reviewed. Both clean.

## Conclusion
Across 11 surfaces the core is **robustly built** — RLS-scoped, DB-constraint-guarded,
integer-cents money, race-safe check-in. Real issues were few and are resolved or
flagged: **M1** (admin-branding trap — open, needs founder decision), the negative
days-left display (**fixed**), and documented scaffolds (coupon/api-key/guest-pass
redemption — forward-harden when built). NOT covered: any on-device PWA/theming render
(server side verified; the OS install is the founder's to confirm). Audit complete.

## Open actions
1. **Founder decision:** M1 — dedup the admin branding (recommend: remove the admin inputs).
2. **Founder apply:** `0057` (verified apply-ready) → trainer bios.
3. **Founder device check:** reinstall the PWA to confirm the rasterized icon holds.
4. **Forward:** hash `api_keys.token` when API-key auth is built.

*Recorded per §1.7 (audits on the record) and §7.3 (append-only). No issue fabricated;
none withheld.*
