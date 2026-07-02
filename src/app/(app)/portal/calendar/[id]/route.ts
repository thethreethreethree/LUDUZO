import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// §4 calendar sync: download an .ics for one of the member's booked class sessions.
// RLS (bookings_select_own, 0022) scopes the fetch to the caller's own booking, so
// a member can only export their own. No DB write.
type Row = { id: string; status: string; session: { starts_at: string; ends_at: string | null; class: { name: string } | null } | null };

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data } = await supabase
    .from("bookings")
    .select("id, status, session:class_sessions(starts_at, ends_at, class:classes(name))")
    .eq("id", id)
    .maybeSingle();
  const row = data as unknown as Row | null;
  if (!row || !row.session) {
    return new NextResponse("Booking not found.", { status: 404 });
  }

  const start = row.session.starts_at;
  const end = row.session.ends_at ?? new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
  const name = row.session.class?.name ?? "Class";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LUDUZO//Member Portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${row.id}@luduzo`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(name)}`,
    `DESCRIPTION:${esc(`Your ${name} class, booked via LUDUZO.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="luduzo-class.ics"`,
    },
  });
}
