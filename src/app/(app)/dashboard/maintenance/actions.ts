"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addSupplier(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const contact_name = String(formData.get("contact_name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!organization_id || !name) redirect("/dashboard/maintenance?error=" + encodeURIComponent("Supplier name is required."));
  const { error } = await supabase.from("suppliers").insert({ organization_id, name, contact_name, email, phone });
  if (error) redirect("/dashboard/maintenance?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/maintenance");
  redirect("/dashboard/maintenance");
}

export async function logMaintenance(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const equipment_id = String(formData.get("equipment_id") ?? "") || null;
  const kind = String(formData.get("kind") ?? "service");
  const scheduled_for = String(formData.get("scheduled_for") ?? "").trim() || null;
  const down = formData.get("down") === "on";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!organization_id) redirect("/dashboard/maintenance?error=" + encodeURIComponent("Gym is required."));
  const { error } = await supabase.from("equipment_maintenance").insert({ organization_id, equipment_id, kind, scheduled_for, down, notes });
  if (error) redirect("/dashboard/maintenance?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/maintenance");
  redirect("/dashboard/maintenance");
}

export async function completeMaintenance(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/maintenance");
  const { error } = await supabase
    .from("equipment_maintenance")
    .update({ completed_at: new Date().toISOString().slice(0, 10), down: false })
    .eq("id", id);
  if (error) redirect("/dashboard/maintenance?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/maintenance");
  redirect("/dashboard/maintenance");
}
