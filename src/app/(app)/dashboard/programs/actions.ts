"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkoutPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!organization_id || !name) redirect("/dashboard/programs?error=" + encodeURIComponent("Gym and plan name are required."));
  const { error } = await supabase.from("workout_plans").insert({ organization_id, member_id, name, notes, created_by: user.id });
  if (error) redirect("/dashboard/programs?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}

export async function addExercise(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const plan_id = String(formData.get("plan_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const sets = numOrNull(formData.get("sets"));
  const reps = numOrNull(formData.get("reps"));
  const weight_kg = numOrNull(formData.get("weight_kg"));
  if (!organization_id || !plan_id || !name) redirect("/dashboard/programs?error=" + encodeURIComponent("Plan and exercise name are required."));
  const { error } = await supabase.from("workout_exercises").insert({ organization_id, plan_id, name, sets, reps, weight_kg });
  if (error) redirect("/dashboard/programs?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}

export async function createMealPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const daily_calorie_target = numOrNull(formData.get("daily_calorie_target"));
  if (!organization_id || !name) redirect("/dashboard/programs?error=" + encodeURIComponent("Gym and plan name are required."));
  const { error } = await supabase.from("meal_plans").insert({ organization_id, member_id, name, daily_calorie_target });
  if (error) redirect("/dashboard/programs?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}

export async function addMealItem(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const meal_plan_id = String(formData.get("meal_plan_id") ?? "");
  const meal = String(formData.get("meal") ?? "meal").trim() || "meal";
  const description = String(formData.get("description") ?? "").trim();
  const calories = numOrNull(formData.get("calories"));
  if (!organization_id || !meal_plan_id || !description) redirect("/dashboard/programs?error=" + encodeURIComponent("Plan and item are required."));
  const { error } = await supabase.from("meal_plan_items").insert({ organization_id, meal_plan_id, meal, description, calories });
  if (error) redirect("/dashboard/programs?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/programs");
  redirect("/dashboard/programs");
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  return s && !Number.isNaN(Number(s)) ? Number(s) : null;
}
