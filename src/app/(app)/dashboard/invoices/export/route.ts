import { createClient } from "@/lib/supabase/server";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /dashboard/invoices/export → CSV of the caller's invoices (RLS-scoped).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("invoices")
    .select("amount_cents, currency, status, due_date, paid_at, created_at, member:members(first_name, last_name)")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return new Response(error.message, { status: 400 });

  type Row = {
    amount_cents: number;
    currency: string;
    status: string;
    due_date: string | null;
    paid_at: string | null;
    created_at: string;
    member: { first_name: string; last_name: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const header = ["member", "amount_cents", "currency", "status", "due_date", "paid_at", "created_at"].join(",");
  const lines = rows.map((r) =>
    [
      csvCell(r.member ? `${r.member.first_name} ${r.member.last_name}` : ""),
      csvCell(r.amount_cents),
      csvCell(r.currency),
      csvCell(r.status),
      csvCell(r.due_date),
      csvCell(r.paid_at),
      csvCell(r.created_at),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="invoices.csv"',
    },
  });
}
