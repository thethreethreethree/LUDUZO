"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function togglePlanActive(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect("/dashboard/plans");
  const { error } = await supabase.from("plans").update({ active: !active }).eq("id", id);
  if (error) redirect("/dashboard/plans?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/plans");
  redirect("/dashboard/plans");
}

export async function createPlan(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const intervalVal = String(formData.get("interval") ?? "month");
  const priceRaw = String(formData.get("price") ?? "").trim();
  const price_cents =
    priceRaw && !Number.isNaN(Number(priceRaw)) ? Math.round(Number(priceRaw) * 100) : 0;

  if (!organization_id || !name) {
    redirect("/dashboard/plans?error=" + encodeURIComponent("Gym and name are required."));
  }

  // RLS (plans_write: owner/admin/manager) enforces permission server-side.
  const { error } = await supabase
    .from("plans")
    .insert({ organization_id, name, description, interval: intervalVal, price_cents });
  if (error) {
    redirect("/dashboard/plans?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/plans");
  redirect("/dashboard/plans");
}
