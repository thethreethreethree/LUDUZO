import { createClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /dashboard/members/export → CSV of the caller's members (RLS-scoped).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("members")
    .select("first_name, last_name, email, phone, member_number, date_of_birth, status, member_since")
    .order("last_name", { ascending: true })
    .limit(5000);
  if (error) return new Response(error.message, { status: 400 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const cols = ["first_name", "last_name", "email", "phone", "member_number", "date_of_birth", "status", "member_since"];
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="members.csv"',
    },
  });
}
