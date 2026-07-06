import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWritableOrgs } from "@/lib/orgs";
import { OrgPicker } from "@/components/OrgPicker";
import { createWorkoutPlan, addExercise, createMealPlan, addMealItem } from "./actions";

export const dynamic = "force-dynamic";

type Exercise = { id: string; name: string; sets: number | null; reps: number | null; weight_kg: number | null };
type WPlan = { id: string; name: string; member: { first_name: string; last_name: string } | null; workout_exercises: Exercise[] };
type MItem = { id: string; meal: string; description: string; calories: number | null };
type MPlan = { id: string; name: string; daily_calorie_target: number | null; member: { first_name: string; last_name: string } | null; meal_plan_items: MItem[] };
type MemberOpt = { id: string; first_name: string; last_name: string };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgs = await getWritableOrgs(supabase);
  const { data: memberData } = await supabase.from("members").select("id, first_name, last_name").order("last_name").limit(500);
  const members = (memberData ?? []) as unknown as MemberOpt[];

  const { data: wData } = await supabase
    .from("workout_plans")
    .select("id, name, member:members(first_name, last_name), workout_exercises(id, name, sets, reps, weight_kg)")
    .order("created_at", { ascending: false }).limit(50);
  const wplans = (wData ?? []) as unknown as WPlan[];

  const { data: mData } = await supabase
    .from("meal_plans")
    .select("id, name, daily_calorie_target, member:members(first_name, last_name), meal_plan_items(id, meal, description, calories)")
    .order("created_at", { ascending: false }).limit(50);
  const mplans = (mData ?? []) as unknown as MPlan[];

  const memberOptions = (
    <>
      <option value="">— template (no member) —</option>
      {members.map((m) => (<option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>))}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-ash hover:underline">← Dashboard</Link>
        <h1 className="mt-1 text-h1 text-bone">Programs</h1>
        <p className="text-sm text-ash">Workout &amp; nutrition plans for members.</p>
      </div>

      {error ? <p className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{error}</p> : null}

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---------- Workout ---------- */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ash">Workout plans</h2>
          {orgs.length > 0 ? (
            <form action={createWorkoutPlan} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
              <OrgPicker orgs={orgs} />
              <input name="name" aria-label="Workout plan name" required placeholder="Plan name (e.g. Push/Pull/Legs)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              <select name="member_id" aria-label="Assign to member (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">{memberOptions}</select>
              <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">New plan</button>
            </form>
          ) : null}
          {wplans.map((p) => (
            <div key={p.id} className="rounded-md border border-onyx bg-onyx p-4 text-sm">
              <div className="font-medium">{p.name}{p.member ? ` · ${p.member.first_name} ${p.member.last_name}` : " · template"}</div>
              <ul className="mt-2 flex flex-col gap-1">
                {p.workout_exercises.map((e) => (
                  <li key={e.id} className="flex justify-between text-xs text-ash">
                    <span>{e.name}</span>
                    <span>{[e.sets && `${e.sets}×`, e.reps, e.weight_kg && `@${e.weight_kg}kg`].filter(Boolean).join(" ")}</span>
                  </li>
                ))}
                {p.workout_exercises.length === 0 ? <li className="text-xs text-ash">No exercises yet.</li> : null}
              </ul>
              <form action={addExercise} className="mt-2 flex flex-wrap gap-2">
                <OrgPicker orgs={orgs} />
                <input type="hidden" name="plan_id" value={p.id} />
                <input name="name" aria-label="Exercise name" required placeholder="Exercise" className="min-w-0 flex-1 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <input name="sets" aria-label="Sets" type="number" placeholder="sets" className="w-14 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <input name="reps" aria-label="Reps" type="number" placeholder="reps" className="w-14 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <input name="weight_kg" aria-label="Weight in kg" type="number" step="0.5" placeholder="kg" className="w-14 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <button className="rounded-md border border-iron px-2 py-1 text-xs hover:border-gold hover:text-gold">Add</button>
              </form>
            </div>
          ))}
          {wplans.length === 0 ? <p className="text-sm text-ash">No workout plans yet.</p> : null}
        </div>

        {/* ---------- Nutrition ---------- */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ash">Nutrition plans</h2>
          {orgs.length > 0 ? (
            <form action={createMealPlan} className="flex flex-col gap-2 rounded-md border border-onyx bg-onyx p-4">
              <OrgPicker orgs={orgs} />
              <div className="flex gap-2">
                <input name="name" aria-label="Nutrition plan name" required placeholder="Plan name" className="min-w-0 flex-1 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
                <input name="daily_calorie_target" aria-label="Daily calorie target" type="number" placeholder="kcal/day" className="w-24 rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2" />
              </div>
              <select name="member_id" aria-label="Assign to member (optional)" className="w-full rounded-md border border-iron px-3 py-2 text-sm bg-onyx-2">{memberOptions}</select>
              <button className="self-start rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">New plan</button>
            </form>
          ) : null}
          {mplans.map((p) => (
            <div key={p.id} className="rounded-md border border-onyx bg-onyx p-4 text-sm">
              <div className="font-medium">{p.name}{p.daily_calorie_target ? ` · ${p.daily_calorie_target} kcal` : ""}{p.member ? ` · ${p.member.first_name} ${p.member.last_name}` : " · template"}</div>
              <ul className="mt-2 flex flex-col gap-1">
                {p.meal_plan_items.map((it) => (
                  <li key={it.id} className="flex justify-between text-xs text-ash">
                    <span><span className="text-ash">{it.meal}:</span> {it.description}</span>
                    <span>{it.calories ? `${it.calories} kcal` : ""}</span>
                  </li>
                ))}
                {p.meal_plan_items.length === 0 ? <li className="text-xs text-ash">No items yet.</li> : null}
              </ul>
              <form action={addMealItem} className="mt-2 flex flex-wrap gap-2">
                <OrgPicker orgs={orgs} />
                <input type="hidden" name="meal_plan_id" value={p.id} />
                <input name="meal" aria-label="Meal" placeholder="meal" className="w-20 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <input name="description" aria-label="Food / item" required placeholder="Food / item" className="min-w-0 flex-1 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <input name="calories" aria-label="Calories" type="number" placeholder="kcal" className="w-16 rounded-md border border-iron px-2 py-1 text-xs bg-onyx-2" />
                <button className="rounded-md border border-iron px-2 py-1 text-xs hover:border-gold hover:text-gold">Add</button>
              </form>
            </div>
          ))}
          {mplans.length === 0 ? <p className="text-sm text-ash">No nutrition plans yet.</p> : null}
        </div>
      </div>
    </main>
  );
}
