import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// §4 calendar sync: download an .ics for one of the member's own bookings
// (default) or PT appointments (?kind=appt). RLS scopes the fetch to the caller's
// own row (bookings 0022 / appointments 0024), so a member can only export their
// own. No DB write.
type Booking = { id: string; session: { starts_at: string; ends_at: string | null; class: { name: string } | null } | null };
type Appt = { id: string; title: string | null; starts_at: string; ends_at: string | null };

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function ics(uid: string, start: string, end: string | null, summary: string, description: string) {
  const dtEnd = end ?? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Member Portal//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@portal`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(dtEnd)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const kind = new URL(request.url).searchParams.get("kind");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // White-label: the calendar event a member adds should reference THEIR gym, not
  // LUDUZO (which would leak our brand into the member's personal calendar).
  const { data: mem } = await supabase.from("members").select("organization:organizations(name)").eq("profile_id", user.id).limit(1);
  const gym = (((mem ?? []) as unknown as { organization: { name: string } | null }[])[0]?.organization?.name) || "your gym";

  let body: string;
  if (kind === "appt") {
    const { data } = await supabase.from("appointments").select("id, title, starts_at, ends_at").eq("id", id).maybeSingle();
    const a = data as unknown as Appt | null;
    if (!a) return new NextResponse("Appointment not found.", { status: 404 });
    const name = a.title ?? "PT session";
    body = ics(`appt-${a.id}`, a.starts_at, a.ends_at, name, `Your ${name}, booked via ${gym}.`);
  } else {
    const { data } = await supabase.from("bookings").select("id, session:class_sessions(starts_at, ends_at, class:classes(name))").eq("id", id).maybeSingle();
    const row = data as unknown as Booking | null;
    if (!row || !row.session) return new NextResponse("Booking not found.", { status: 404 });
    const name = row.session.class?.name ?? "Class";
    body = ics(`booking-${row.id}`, row.session.starts_at, row.session.ends_at, name, `Your ${name} class, booked via ${gym}.`);
  }

  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="session.ics"`,
    },
  });
}
