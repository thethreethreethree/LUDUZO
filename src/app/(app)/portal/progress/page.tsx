import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logMeasurement, joinChallenge, setUnits } from "../actions";

const LB_PER_KG = 2.20462;

export const dynamic = "force-dynamic";

type Exercise = { id: string; name: string; sets: number | null; reps: number | null; weight_kg: number | null };
type WPlan = { id: string; name: string; workout_exercises: Exercise[] };
type MItem = { id: string; meal: string; description: string; calories: number | null };
type MPlan = { id: string; name: string; daily_calorie_target: number | null; meal_plan_items: MItem[] };
type Measure = { id: string; recorded_at: string; weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null };
type Badge = { id: string; awarded_at: string; badge: { name: string; icon: string | null } | null };
type Challenge = { id: string; name: string; description: string | null; metric: string; goal_target: number | null; starts_on: string | null; ends_on: string | null };
type Participation = { challenge_id: string; progress: number };

const OK_MSG: Record<string, string> = { logged: "Measurement logged.", joined: "You're in — good luck." };

export default async function PortalProgressPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberData } = await supabase.from("members").select("id").eq("profile_id", user.id);
  const ids = ((memberData ?? []) as { id: string }[]).map((m) => m.id);
  if (ids.length === 0) redirect("/portal");

  const [{ data: wData }, { data: mpData }, { data: measData }, { data: badgeData }, { data: visitData }, { data: chData }, { data: partData }] = await Promise.all([
    supabase.from("workout_plans").select("id, name, workout_exercises(id, name, sets, reps, weight_kg)").in("member_id", ids).order("created_at", { ascending: false }).limit(10),
    supabase.from("meal_plans").select("id, name, daily_calorie_target, meal_plan_items(id, meal, description, calories)").in("member_id", ids).order("created_at", { ascending: false }).limit(10),
    supabase.from("member_measurements").select("id, recorded_at, weight_kg, body_fat_pct, muscle_mass_kg").in("member_id", ids).order("recorded_at", { ascending: false }).limit(24),
    supabase.from("member_badges").select("id, awarded_at, badge:badges(name, icon)").in("member_id", ids).order("awarded_at", { ascending: false }).limit(20),
    supabase.from("checkins").select("checked_in_at").in("member_id", ids).order("checked_in_at", { ascending: false }).limit(60),
    // Challenges + own participation now readable via 0036 (member-scoped).
    supabase.from("challenges").select("id, name, description, metric, goal_target, starts_on, ends_on").order("starts_on", { ascending: false }).limit(20),
    supabase.from("challenge_participants").select("challenge_id, progress").in("member_id", ids),
  ]);

  const wplans = (wData ?? []) as unknown as WPlan[];
  const mplans = (mpData ?? []) as unknown as MPlan[];
  const measures = (measData ?? []) as unknown as Measure[];
  const badges = (badgeData ?? []) as unknown as Badge[];
  const visits = (visitData ?? []) as { checked_in_at: string }[];
  const challenges = (chData ?? []) as unknown as Challenge[];
  const participation = (partData ?? []) as unknown as Participation[];
  const joinedProgress = new Map(participation.map((p) => [p.challenge_id, p.progress]));

  // §12 units: member weight-unit preference (cookie). DB stores kg; convert for display.
  const units = ((await cookies()).get("units")?.value === "lb") ? "lb" : "kg";
  const wUnit = units === "lb" ? "lb" : "kg";
  const disp = (kg: number) => (units === "lb" ? Math.round(kg * LB_PER_KG * 10) / 10 : kg);

  // weight trend (oldest→newest) for a tiny sparkline (min/max computed in kg)
  const weights = measures.filter((m) => m.weight_kg != null).map((m) => m.weight_kg as number).reverse();
  const wMin = Math.min(...weights, Infinity), wMax = Math.max(...weights, -Infinity);
  const latest = measures[0];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 pb-28 pt-8">
      <h1 className="text-2xl font-extrabold text-bone">Your progress</h1>

      {ok ? <p className="rounded-md border border-win/40 bg-win/10 px-3 py-2 text-sm text-win">{OK_MSG[ok] ?? "Done."}</p> : null}
      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      {/* body metrics */}
      <section className="rounded-2xl border border-iron bg-onyx p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-bold text-bone">Body metrics</div>
          {/* §12 kg/lb toggle */}
          <div className="flex overflow-hidden rounded-md border border-iron text-[11px] font-bold">
            {(["kg", "lb"] as const).map((u) => (
              <form key={u} action={setUnits}>
                <input type="hidden" name="units" value={u} />
                <button className={u === wUnit ? "bg-gold px-2.5 py-1 text-black" : "px-2.5 py-1 text-ash hover:text-gold"}>{u.toUpperCase()}</button>
              </form>
            ))}
          </div>
        </div>
        {measures.length === 0 ? (
          <p className="text-sm text-ash">No measurements logged yet — record your first below, or your trainer can add them.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric label="Weight" value={latest.weight_kg != null ? `${disp(latest.weight_kg)}` : "—"} unit={wUnit} />
              <Metric label="Body fat" value={latest.body_fat_pct != null ? `${latest.body_fat_pct}` : "—"} unit="%" />
              <Metric label="Muscle" value={latest.muscle_mass_kg != null ? `${disp(latest.muscle_mass_kg)}` : "—"} unit={wUnit} />
            </div>
            {weights.length > 1 ? (
              <div className="mt-4 flex h-16 items-end gap-1">
                {weights.map((w, i) => {
                  const pct = wMax > wMin ? ((w - wMin) / (wMax - wMin)) * 100 : 50;
                  return <div key={i} className="flex-1 rounded-t bg-gold" style={{ height: `${20 + pct * 0.8}%` }} title={`${disp(w)}${wUnit}`} />;
                })}
              </div>
            ) : null}
            <p className="mono mt-2 text-[11px] text-ash-dim">Last {measures.length} readings</p>
            {weights.length > 1 ? (() => {
              const deltaKg = weights[weights.length - 1] - weights[0];
              const d = Math.round(disp(Math.abs(deltaKg)) * 10) / 10;
              if (d === 0) return <p className="mt-1 text-xs text-ash">No change in weight since your first reading.</p>;
              const down = deltaKg < 0;
              return <p className={`mt-1 text-xs font-semibold ${down ? "text-win" : "text-warn"}`}>{down ? "▼" : "▲"} {d} {wUnit} {down ? "down" : "up"} since your first reading</p>;
            })() : null}
          </>
        )}
        {/* Self-log — uses live 0034 member_measurements_member_insert RLS. */}
        <form action={logMeasurement} className="mt-4 border-t border-iron pt-4">
          <input type="hidden" name="units" value={wUnit} />
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-ash">Log a measurement ({wUnit})</div>
          <div className="grid grid-cols-3 gap-2">
            <input name="weight_kg" inputMode="decimal" placeholder={`Weight ${wUnit}`} className="min-w-0 rounded-md border border-iron bg-onyx-2 px-2.5 py-2 text-sm text-bone placeholder:text-ash-dim" />
            <input name="body_fat_pct" inputMode="decimal" placeholder="Fat %" className="min-w-0 rounded-md border border-iron bg-onyx-2 px-2.5 py-2 text-sm text-bone placeholder:text-ash-dim" />
            <input name="muscle_mass_kg" inputMode="decimal" placeholder={`Muscle ${wUnit}`} className="min-w-0 rounded-md border border-iron bg-onyx-2 px-2.5 py-2 text-sm text-bone placeholder:text-ash-dim" />
          </div>
          <button className="mt-2 w-full rounded-md bg-gold py-2 text-sm font-bold text-black hover:brightness-110">Save today&apos;s reading</button>
        </form>
      </section>

      {/* challenges — browse + join (0036 read, 0034 join) */}
      {challenges.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">Challenges</div>
          <ul className="flex flex-col gap-2">
            {challenges.map((c) => {
              const joined = joinedProgress.has(c.id);
              const prog = joinedProgress.get(c.id) ?? 0;
              const pct = c.goal_target && c.goal_target > 0 ? Math.min(100, Math.round((prog / c.goal_target) * 100)) : null;
              return (
                <li key={c.id} className="rounded-2xl border border-iron bg-onyx p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-bone">{c.name}</div>
                      {c.description ? <div className="truncate text-xs text-ash">{c.description}</div> : null}
                    </div>
                    {joined ? (
                      <span className="shrink-0 rounded-md bg-win/15 px-3 py-1.5 text-xs font-bold text-win">Joined ✓</span>
                    ) : (
                      <form action={joinChallenge} className="shrink-0">
                        <input type="hidden" name="challenge_id" value={c.id} />
                        <button className="rounded-md bg-gold px-4 py-1.5 text-xs font-bold text-black hover:brightness-110">Join</button>
                      </form>
                    )}
                  </div>
                  {joined && pct != null ? (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-iron"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
                      <div className="mono mt-1 text-[11px] text-ash">{prog} / {c.goal_target} {c.metric}</div>
                    </div>
                  ) : joined ? (
                    <div className="mono mt-2 text-[11px] text-ash">Progress: {prog} {c.metric}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* workout plans */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Your workout plan</div>
        {wplans.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No plan assigned yet — ask your trainer.</div>
        ) : (
          wplans.map((p) => (
            <div key={p.id} className="mb-3 rounded-2xl border border-iron bg-onyx p-4">
              <div className="font-bold text-bone">{p.name}</div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {p.workout_exercises.map((e) => (
                  <li key={e.id} className="flex justify-between text-sm">
                    <span className="text-bone">{e.name}</span>
                    <span className="mono text-xs text-ash">{[e.sets && `${e.sets}×`, e.reps, e.weight_kg && `@${e.weight_kg}kg`].filter(Boolean).join(" ")}</span>
                  </li>
                ))}
                {p.workout_exercises.length === 0 ? <li className="text-xs text-ash-dim">No exercises yet.</li> : null}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* nutrition */}
      {mplans.length > 0 ? (
        <section>
          <div className="mb-2 text-[15px] font-bold text-bone">Nutrition</div>
          {mplans.map((p) => (
            <div key={p.id} className="mb-3 rounded-2xl border border-iron bg-onyx p-4">
              <div className="font-bold text-bone">{p.name}{p.daily_calorie_target ? <span className="mono ml-2 text-xs text-ash">{p.daily_calorie_target} kcal/day</span> : null}</div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {p.meal_plan_items.map((it) => (
                  <li key={it.id} className="flex justify-between text-ash"><span><span className="text-ash-dim">{it.meal}:</span> {it.description}</span><span className="mono text-xs">{it.calories ? `${it.calories}` : ""}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {/* badges */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Badges</div>
        {badges.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">Earn badges by training. 🏅</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {badges.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-gold-line bg-gold-dim px-3 py-1.5 text-xs font-semibold text-gold">
                {b.badge?.icon ? `${b.badge.icon} ` : "🏅 "}{b.badge?.name ?? "Badge"}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* recent visits */}
      <section>
        <div className="mb-2 text-[15px] font-bold text-bone">Recent visits</div>
        {visits.length === 0 ? (
          <div className="rounded-2xl border border-iron bg-onyx p-4 text-sm text-ash">No visits yet.</div>
        ) : (
          <ul className="flex flex-col divide-y divide-iron rounded-2xl border border-iron bg-onyx">
            {visits.slice(0, 8).map((v, i) => (
              <li key={i} className="mono px-4 py-2.5 text-xs text-ash">{new Date(v.checked_in_at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-iron bg-onyx-2 p-3">
      <div className="text-[10px] uppercase tracking-[0.07em] text-ash">{label}</div>
      <div className="mono mt-1 text-xl font-extrabold text-bone">{value}<span className="ml-0.5 text-xs text-ash">{unit}</span></div>
    </div>
  );
}
