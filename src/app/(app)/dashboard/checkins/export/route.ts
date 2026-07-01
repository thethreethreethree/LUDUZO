import { createClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = {
  checked_in_at: string;
  checked_out_at: string | null;
  method: string | null;
  member: { first_name: string; last_name: string } | null;
};

// GET /dashboard/checkins/export → CSV of attendance (RLS-scoped).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("checkins")
    .select("checked_in_at, checked_out_at, method, member:members(first_name, last_name)")
    .order("checked_in_at", { ascending: false })
    .limit(10000);
  if (error) return new Response(error.message, { status: 400 });

  const rows = (data ?? []) as unknown as Row[];
  const header = ["member", "checked_in_at", "checked_out_at", "method"].join(",");
  const lines = rows.map((r) =>
    [
      csvCell(r.member ? `${r.member.first_name} ${r.member.last_name}` : ""),
      csvCell(r.checked_in_at),
      csvCell(r.checked_out_at),
      csvCell(r.method),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance.csv"',
    },
  });
}
