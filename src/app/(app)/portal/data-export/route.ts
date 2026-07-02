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
  const [bookings, measurements, workouts, invoices, subscriptions, checkins, notifications, badges] = await Promise.all([
    inMine("bookings"),
    inMine("member_measurements"),
    inMine("member_workout_logs"),
    inMine("invoices"),
    inMine("subscriptions"),
    inMine("checkins"),
    inMine("notifications"),
    inMine("member_badges"),
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
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="luduzo-my-data.json"`,
    },
  });
}
