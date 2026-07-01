"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateLocation(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw && !Number.isNaN(Number(capRaw)) ? Number(capRaw) : null;
  if (!id || !name) {
    redirect("/dashboard/locations?error=" + encodeURIComponent("Name is required."));
  }
  const { error } = await supabase
    .from("locations")
    .update({ name, status, capacity })
    .eq("id", id);
  if (error) redirect("/dashboard/locations?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/locations");
  redirect("/dashboard/locations");
}

export async function createLocation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capRaw && !Number.isNaN(Number(capRaw)) ? Number(capRaw) : null;

  if (!organization_id || !name) {
    redirect("/dashboard/locations?error=" + encodeURIComponent("Gym and name are required."));
  }

  // RLS (loc_write: owner/admin/manager) enforces permission server-side.
  const { error } = await supabase
    .from("locations")
    .insert({ organization_id, name, timezone, capacity });
  if (error) {
    redirect("/dashboard/locations?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/locations");
  redirect("/dashboard/locations");
}
