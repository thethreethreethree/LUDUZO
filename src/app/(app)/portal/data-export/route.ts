import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// §12 GDPR data control: a member downloads a JSON of THEIR OWN data. Every query
// is RLS-scoped to the caller's own member rows (0015/0022/etc.), so this exposes
// nothing beyond what the member already sees. Read-only, no DB change.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Explicit columns only — never dump staff-internal `notes` or the `qr_token`
  // check-in credential into the export (audit Finding 1). Whether members should
  // see staff notes (A10) is a founder decision, flagged separately.
  const { data: memberRows } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, phone, member_number, date_of_birth, status, member_since, goals, fitness_level, created_at")
    .eq("profile_id", user.id);
  const ids = ((memberRows ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) return new NextResponse("No membership on file.", { status: 404 });

  const inMine = (t: string, cols = "*") => supabase.from(t).select(cols).in("member_id", ids);
  const [bookings, measurements, workouts, invoices, subscriptions, checkins, notifications, badges, appointments, loyalty, redemptions, documents, referrals, comments, reviews, nps] = await Promise.all([
    inMine("bookings"),
    inMine("member_measurements"),
    inMine("member_workout_logs"),
    inMine("invoices"),
    inMine("subscriptions"),
    inMine("checkins"),
    inMine("notifications"),
    inMine("member_badges"),
    // Explicit columns for the newly-added types: exclude appointments.notes (staff),
    // member_documents.file_path/signature (storage/internal), referrals.referred_email
    // (third-party PII) — completeness without leaking beyond the member's own data.
    inMine("appointments", "title, starts_at, ends_at, status, price_cents, created_at"),
    inMine("loyalty_transactions", "points, reason, created_at"),
    inMine("reward_redemptions", "reward_name, points_spent, status, created_at"),
    inMine("member_documents", "kind, status, signed_at, expires_at, created_at"),
    supabase.from("referrals").select("referred_name, status, created_at").in("referrer_member_id", ids),
    // Member-authored content (their own comments + feedback). reviews/nps populate
    // only if a member-read RLS exists; otherwise they degrade to [] (graceful).
    supabase.from("community_comments").select("body, created_at").in("author_member_id", ids),
    inMine("reviews", "rating, comment, created_at"),
    inMine("nps_responses", "score, comment, created_at"),
  ]);

  // Absent tables (unapplied migrations) resolve to error/null → emit [] not a crash.
  const rows = (r: { data: unknown }) => (Array.isArray(r?.data) ? r.data : []);
  const bundle = {
    exported_at: new Date().toISOString(),
    account_email: user.email,
    members: memberRows ?? [],
    bookings: rows(bookings),
    measurements: rows(measurements),
    workout_logs: rows(workouts),
    invoices: rows(invoices),
    subscriptions: rows(subscriptions),
    checkins: rows(checkins),
    notifications: rows(notifications),
    badges: rows(badges),
    appointments: rows(appointments),
    loyalty_transactions: rows(loyalty),
    reward_redemptions: rows(redemptions),
    documents: rows(documents),
    referrals: rows(referrals),
    community_comments: rows(comments),
    reviews: rows(reviews),
    nps_responses: rows(nps),
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="luduzo-my-data.json"`,
    },
  });
}
