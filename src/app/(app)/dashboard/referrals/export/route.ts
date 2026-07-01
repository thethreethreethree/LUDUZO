import { createClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /dashboard/referrals/export → CSV of the caller's referrals (RLS-scoped).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("referrals")
    .select("referred_name, referred_email, status, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return new Response(error.message, { status: 400 });

  const rows = (data ?? []) as Record<string, unknown>[];
  const cols = ["referred_name", "referred_email", "status", "created_at"];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="referrals.csv"',
    },
  });
}
