"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function recordReview(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const rating = Number(formData.get("rating") ?? 0);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  if (!organization_id || !(rating >= 1 && rating <= 5)) redirect("/dashboard/feedback?error=" + encodeURIComponent("A rating 1–5 is required."));
  const { error } = await supabase.from("reviews").insert({ organization_id, member_id, rating, comment });
  if (error) redirect("/dashboard/feedback?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/feedback");
  redirect("/dashboard/feedback");
}

export async function recordNps(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const member_id = String(formData.get("member_id") ?? "") || null;
  const score = Number(formData.get("score") ?? -1);
  const comment = String(formData.get("comment") ?? "").trim() || null;
  if (!organization_id || !(score >= 0 && score <= 10)) redirect("/dashboard/feedback?error=" + encodeURIComponent("A score 0–10 is required."));
  const { error } = await supabase.from("nps_responses").insert({ organization_id, member_id, score, comment });
  if (error) redirect("/dashboard/feedback?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/feedback");
  redirect("/dashboard/feedback");
}
