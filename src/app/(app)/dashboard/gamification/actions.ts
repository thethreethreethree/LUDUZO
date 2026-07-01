"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function createBadge(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!organization_id || !name) redirect("/dashboard/gamification?error=" + encodeURIComponent("Gym and badge name are required."));
  const { error } = await supabase.from("badges").insert({ organization_id, name, icon, description });
  if (error) redirect("/dashboard/gamification?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/gamification");
  redirect("/dashboard/gamification");
}

export async function awardBadge(formData: FormData) {
  const supabase = await createClient();
  const organization_id = String(formData.get("organization_id") ?? "");
  const badge_id = String(formData.get("badge_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "");
  if (!organization_id || !badge_id || !member_id) redirect("/dashboard/gamification?error=" + encodeURIComponent("Pick a badge and a member."));
  const { error } = await supabase.from("member_badges").insert({ organization_id, badge_id, member_id });
  if (error) {
    const msg = isUniqueViolation(error) ? "That member already has this badge." : error.message;
    redirect("/dashboard/gamification?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/gamification");
  redirect("/dashboard/gamification?ok=" + encodeURIComponent("Badge awarded."));
}

export async function createChallenge(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const goalRaw = String(formData.get("goal_target") ?? "").trim();
  const goal_target = goalRaw && !Number.isNaN(Number(goalRaw)) ? Number(goalRaw) : null;
  const starts_on = String(formData.get("starts_on") ?? "").trim() || null;
  const ends_on = String(formData.get("ends_on") ?? "").trim() || null;
  if (!organization_id || !name) redirect("/dashboard/gamification?error=" + encodeURIComponent("Gym and challenge name are required."));
  const { error } = await supabase.from("challenges").insert({ organization_id, name, description, goal_target, starts_on, ends_on });
  if (error) redirect("/dashboard/gamification?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/gamification");
  redirect("/dashboard/gamification");
}
