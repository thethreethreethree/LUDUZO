"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateStaffRole(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!id) redirect("/dashboard/staff");
  if (user_id === user.id) {
    redirect("/dashboard/staff?error=" + encodeURIComponent("You can't change your own role."));
  }
  // RLS (orgmem_write: owner/admin) enforces who may change roles.
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", id);
  if (error) redirect("/dashboard/staff?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?ok=1");
}

export async function removeStaff(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const user_id = String(formData.get("user_id") ?? "");
  if (!id) redirect("/dashboard/staff");
  if (user_id === user.id) {
    redirect("/dashboard/staff?error=" + encodeURIComponent("You can't remove yourself."));
  }
  // RLS (orgmem_write: owner/admin) enforces who may remove staff.
  const { error } = await supabase.from("organization_members").delete().eq("id", id);
  if (error) redirect("/dashboard/staff?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?ok=1");
}

export async function addStaff(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const p_org = String(formData.get("organization_id") ?? "");
  const p_email = String(formData.get("email") ?? "").trim();
  const p_role = String(formData.get("role") ?? "front_desk");
  if (!p_org || !p_email) {
    redirect("/dashboard/staff?error=" + encodeURIComponent("Gym and email are required."));
  }

  // add_staff_member() (migration 0021) verifies owner/admin and links the user.
  const { error } = await supabase.rpc("add_staff_member", { p_org, p_email, p_role });
  if (error) {
    redirect("/dashboard/staff?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/staff");
  redirect("/dashboard/staff?ok=1");
}
