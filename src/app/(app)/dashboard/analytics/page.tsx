import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/billing";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: memberRows }, { data: checkinRows }, { data: invoiceRows }, { data: apptRows }] = await Promise.all([
    supabase.from("members").select("id, status, member_since").limit(5000),
    supabase.from("checkins").select("checked_in_at").order("checked_in_at", { ascending: false }).limit(20000),
    supabase.from("invoices").select("amount_cents, status, created_at").limit(5000),
    supabase.from("appointments").select("trainer_id, status, trainer:profiles(full_name)").limit(5000),
  ]);
  const members = (memberRows ?? []) as { id: string; status: string; member_since: string | null }[];
  const checkins = (checkinRows ?? []) as { checked_in_at: string }[];
  const invoices = (invoiceRows ?? []) as { amount_cents: number; status: string; created_at: string }[];
  const appts = (apptRows ?? []) as unknown as { trainer_id: string | null; status: string; trainer: { full_name: string | null } | null }[];

  // --- Peak-hour heatmap: day-of-week × hour bucket ---
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let heatMax = 0;
  for (const c of checkins) {
    const d = new Date(c.checked_in_at);
    const v = ++heat[d.getDay()][d.getHours()];
    if (v > heatMax) heatMax = v;
  }

  // --- Membership growth (joins per month, last 12) ---
  const joinsByMonth = new Map<string, number>();
  for (const m of members) if (m.member_since) joinsByMonth.set(monthKey(m.member_since), (joinsByMonth.get(monthKey(m.member_since)) ?? 0) + 1);

  // --- Revenue trend (paid invoices per month) + naive forecast ---
  const revByMonth = new Map<string, number>();
  for (const i of invoices) if (i.status === "paid") revByMonth.set(monthKey(i.created_at), (revByMonth.get(monthKey(i.created_at)) ?? 0) + i.amount_cents);
  const last6Keys = [...Array(6)].map((_, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - idx));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const revSeries = last6Keys.map((k) => revByMonth.get(k) ?? 0);
  const last3 = revSeries.slice(-3);
  const forecast = Math.round(last3.reduce((a, b) => a + b, 0) / (last3.length || 1));

  // --- Trainer performance ---
  const trainerStats = new Map<string, { name: string; total: number; completed: number }>();
  for (const a of appts) {
    if (!a.trainer_id) continue;
    const s = trainerStats.get(a.trainer_id) ?? { name: a.trainer?.full_name ?? "(trainer)", total: 0, completed: 0 };
    s.total++;
    if (a.status === "completed") s.completed++;
    trainerStats.set(a.trainer_id, s);
  }
  const trainers = [...trainerStats.values()].sort((a, b) => b.completed - a.completed);

  const active = members.filter((m) => m.status === "active").length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-ash hover:underline print:hidden">← Dashboard</Link>
          <h1 className="mt-1 text-h1 text-bone">Analytics</h1>
          <p className="text-sm text-ash">Attendance, growth, revenue &amp; trainer performance.</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { k: "Members", v: members.length },
          { k: "Active", v: active },
          { k: "Check-ins", v: checkins.length },
          { k: "Forecast rev.", v: formatMoney(forecast) },
        ].map((c) => (
          <div key={c.k} className="rounded-md border border-onyx bg-onyx p-4">
            <div className="text-xs text-ash">{c.k}</div>
            <div className="mt-1 font-display text-xl font-extrabold">{c.v}</div>
          </div>
        ))}
      </div>

      {/* Peak-hour heatmap */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Peak hours (check-ins)</h2>
        <div className="overflow-x-auto rounded-md border border-onyx bg-onyx p-3">
          <table className="border-separate" style={{ borderSpacing: "2px" }}>
            <tbody>
              {heat.map((row, d) => (
                <tr key={d}>
                  <td className="pr-2 text-[10px] text-ash">{DOW[d]}</td>
                  {row.map((v, h) => {
                    const intensity = heatMax ? v / heatMax : 0;
                    return (
                      <td key={h} title={`${DOW[d]} ${h}:00 — ${v}`}
                        style={{ width: 12, height: 12, background: v ? `rgba(254,206,0,${0.15 + intensity * 0.85})` : "#141414" }}
                        className="rounded-[2px]" />
                    );
                  })}
                </tr>
              ))}
              <tr><td /><td colSpan={24} className="pt-1 text-[9px] text-ash">0h → 23h</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue trend + forecast */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ash">Revenue (paid) · last 6 mo</h2>
          <div className="flex items-end gap-1 rounded-md border border-onyx bg-onyx p-3" style={{ height: 120 }}>
            {revSeries.map((v, i) => {
              const max = Math.max(...revSeries, forecast, 1);
              return (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t bg-gold" style={{ height: `${(v / max) * 80}px` }} />
                  <span className="text-[9px] text-ash">{last6Keys[i].slice(5)}</span>
                </div>
              );
            })}
            <div className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-t border border-dashed border-gold" style={{ height: `${(forecast / Math.max(...revSeries, forecast, 1)) * 80}px` }} />
              <span className="text-[9px] text-gold">next*</span>
            </div>
          </div>
          <p className="text-[10px] text-ash">*forecast = mean of last 3 months (trend estimate, not a prediction).</p>
        </section>

        {/* Membership growth */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ash">New members · by month</h2>
          <ul className="flex flex-col gap-1 rounded-md border border-onyx bg-onyx p-3 text-sm">
            {last6Keys.map((k) => (
              <li key={k} className="flex items-center justify-between text-xs">
                <span className="text-ash">{MONTHS[Number(k.slice(5)) - 1]} {k.slice(0, 4)}</span>
                <span className="font-medium">{joinsByMonth.get(k) ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Trainer performance */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-ash">Trainer performance (appointments)</h2>
        {trainers.length === 0 ? (
          <p className="text-sm text-ash">No appointment data yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-onyx rounded-md border border-onyx">
            {trainers.map((t, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{t.name}</span>
                <span className="text-xs text-ash">{t.completed}/{t.total} completed</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
