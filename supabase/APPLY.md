# LUDUZO — apply & verify runbook

> ⏳ **Currency note (2026-07):** the table below details migrations through `0023`. The repo now
> has migrations through **`0061`**. Verified applied against the live DB: `0058`–`0061` (2026-07).
> **`0057_staff_profile.sql` (trainer bios) is authored + apply-verified but NOT yet applied** — it's
> the one currently-pending migration; apply it via the Supabase SQL editor (it degrades gracefully
> until then). For migrations past `0023`, apply in numeric order from `migrations/`; each carries its
> own `⚠ STATUS` header. See `docs/audits/` for what's been verified.

Apply each migration in `migrations/` **in numeric order**, then run its probe in `tests/`.
Every probe is rollback-safe (writes nothing) and prints a result GRID — the last row
should read `OVERALL | ALL PASS`. Paste any non-`ALL PASS` grid back for diagnosis.

| # | Migration | Probe | Expect | Depends on |
|---|-----------|-------|--------|-----------|
| 1 | `0001_foundation.sql` | `0001_foundation_rls_verify.sql` | 23/23 ✅ (already verified 2026-06-29) | — |
| 2 | `0002_members.sql` | `0002_members_rls_verify.sql` | 10 | 0001 |
| 3 | `0003_relationships_guests_referrals.sql` | `0003_relationships_rls_verify.sql` | 7 | 0002 |
| 4 | `0004_documents.sql` | `0004_documents_rls_verify.sql` | 7 (+ manual Storage check) | 0002 |
| 5 | `0005_billing.sql` | `0005_billing_rls_verify.sql` | 7 | 0002 |
| 6 | `0006_checkins.sql` | `0006_checkins_rls_verify.sql` | 8 | 0002 |
| 7 | `0007_classes_bookings.sql` | `0007_classes_bookings_rls_verify.sql` | 6 | 0002 |
| 8 | `0008_inventory.sql` | `0008_inventory_rls_verify.sql` | 5 | 0002 |
| 9 | `0009_announcements.sql` | `0009_announcements_rls_verify.sql` | 5 | 0002 |
| 10 | `0010_coupons.sql` | `0010_coupons_rls_verify.sql` | 5 | 0002 |
| 11 | `0011_pos_sale.sql` | `0011_pos_sale_verify.sql` | 5 | 0005 + 0008 |
| 12 | `0012_booking_capacity.sql` | `0012_booking_capacity_verify.sql` | 3 | 0007 |
| 13 | `0013_payroll.sql` | `0013_payroll_rls_verify.sql` | 5 | 0002 |
| 14 | `0014_measurements.sql` | `0014_measurements_rls_verify.sql` | 4 | 0002 |
| 15 | `0015_member_portal.sql` | `0015_member_portal_verify.sql` | 6 | 0005 + 0014 |
| 16 | `0016_loyalty.sql` | `0016_loyalty_rls_verify.sql` | 5 | 0015 |
| 17 | `0017_communications.sql` | `0017_communications_rls_verify.sql` | 4 | 0002 |
| 18 | `0018_checkin_unique.sql` | `0018_checkin_unique_verify.sql` | 2 | 0006 |
| 19 | `0019_member_announcements_read.sql` | `0019_member_announcements_verify.sql` | 2 | 0009 + 0015 |
| 20 | `0020_member_self_sign.sql` | `0020_member_self_sign_verify.sql` | 2 | 0004 + 0015 |
| 21 | `0021_add_staff.sql` | `0021_add_staff_verify.sql` | 3 | 0001 |
| 22 | `0022_bookings_member_read.sql` | `0022_bookings_member_read_verify.sql` | 2 | 0007 + 0015 |
| 23 | `0023_group_member_read.sql` | `0023_group_member_read_verify.sql` | 2 | 0003 + 0015 + 0019 |

Notes:
- **Idempotent (A12):** every migration is safe to re-run.
- **Ordering verified:** every helper/table is defined before use; applying 0001→0016 in order is safe.
- **0004 Storage policies** are not probe-covered — validate by uploading/reading a file in the
  `member-documents` bucket as a staff user vs a foreign-tenant user.
- **Stripe is not integrated** — `stripe_*` columns are reserved; the C3 Stripe-Connect decision is pending.
- After DB verification, run the app: `npm install && npm run dev`, open `/`.
