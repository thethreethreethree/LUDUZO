"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createShift(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const staff_id = String(formData.get("staff_id") ?? "");
  const starts_at = String(formData.get("starts_at") ?? "");
  const ends_at = String(formData.get("ends_at") ?? "");
  const role_label = String(formData.get("role_label") ?? "").trim() || null;
  if (!organization_id || !staff_id || !starts_at || !ends_at) {
    redirect("/dashboard/shifts?error=" + encodeURIComponent("Staff, start and end are required."));
  }
  if (new Date(ends_at) <= new Date(starts_at)) {
    redirect("/dashboard/shifts?error=" + encodeURIComponent("End must be after start."));
  }
  const { error } = await supabase.from("staff_shifts").insert({ organization_id, staff_id, starts_at, ends_at, role_label });
  if (error) redirect("/dashboard/shifts?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/shifts");
}

export async function deleteShift(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/shifts");
  const { error } = await supabase.from("staff_shifts").delete().eq("id", id);
  if (error) redirect("/dashboard/shifts?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/shifts");
  redirect("/dashboard/shifts");
}
