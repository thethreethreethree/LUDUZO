import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// §8 receipts: a printable HTML receipt for one of the member's OWN invoices.
// RLS (invoices own-read) scopes the fetch; the browser's "Print → Save as PDF"
// produces the PDF. Read-only, no DB change.
type Inv = { id: string; amount_cents: number; currency: string; status: string; created_at: string; due_date: string | null; member: { first_name: string; last_name: string; member_number: string | null; organization: { name: string } | null } | null };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const money = (cents: number, cur: string) => new Intl.NumberFormat("en", { style: "currency", currency: (cur || "usd").toUpperCase() }).format(cents / 100);

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data } = await supabase
    .from("invoices")
    .select("id, amount_cents, currency, status, created_at, due_date, member:members(first_name, last_name, member_number, organization:organizations(name))")
    .eq("id", id)
    .maybeSingle();
  const inv = data as unknown as Inv | null;
  if (!inv) return new NextResponse("Receipt not found.", { status: 404 });

  const gym = inv.member?.organization?.name ?? "Your gym";
  const who = inv.member ? `${inv.member.first_name} ${inv.member.last_name}` : "Member";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt · ${esc(gym)}</title>
<style>
  :root{color-scheme:light}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:620px;margin:2rem auto;padding:0 1.25rem;color:#161616}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #161616;padding-bottom:1rem}
  h1{font-size:1.4rem;margin:0}
  .muted{color:#666;font-size:.85rem}
  table{width:100%;border-collapse:collapse;margin-top:1.5rem}
  td{padding:.5rem 0;border-bottom:1px solid #eee}
  .total{font-size:1.25rem;font-weight:700}
  .badge{display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.75rem;font-weight:700;background:#eee}
  .paid{background:#d8f5e0;color:#0a7d33}
  button{margin-top:1.5rem;padding:.6rem 1.2rem;border:1px solid #161616;border-radius:8px;background:#F5C518;font-weight:700;cursor:pointer}
  @media print{button{display:none}}
</style></head>
<body>
  <div class="head">
    <div><h1>${esc(gym)}</h1><div class="muted">Receipt</div></div>
    <div class="muted" style="text-align:right">${new Date(inv.created_at).toLocaleDateString()}<br>#${esc(inv.id.slice(0, 8))}</div>
  </div>
  <table>
    <tr><td>Member</td><td style="text-align:right">${esc(who)}${inv.member?.member_number ? ` · #${esc(inv.member.member_number)}` : ""}</td></tr>
    <tr><td>Status</td><td style="text-align:right"><span class="badge ${inv.status === "paid" ? "paid" : ""}">${esc(inv.status)}</span></td></tr>
    ${inv.due_date ? `<tr><td>Due</td><td style="text-align:right">${new Date(inv.due_date).toLocaleDateString()}</td></tr>` : ""}
    <tr><td class="total">Amount</td><td class="total" style="text-align:right">${esc(money(inv.amount_cents, inv.currency))}</td></tr>
  </table>
  <button onclick="window.print()">Print / Save as PDF</button>
</body></html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
