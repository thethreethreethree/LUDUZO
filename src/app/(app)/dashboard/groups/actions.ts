"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateGroup(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const group_type = String(formData.get("group_type") ?? "family");
  if (!id || !name) {
    redirect(`/dashboard/groups/${id}?error=` + encodeURIComponent("Name is required."));
  }
  const { error } = await supabase.from("member_groups").update({ name, group_type }).eq("id", id);
  if (error) redirect(`/dashboard/groups/${id}?error=` + encodeURIComponent(error.message));
  revalidatePath(`/dashboard/groups/${id}`);
  redirect(`/dashboard/groups/${id}`);
}

export async function createGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const group_type = String(formData.get("group_type") ?? "family");

  if (!organization_id || !name) {
    redirect("/dashboard/groups?error=" + encodeURIComponent("Gym and name are required."));
  }

  const { error } = await supabase
    .from("member_groups")
    .insert({ organization_id, name, group_type });
  if (error) {
    redirect("/dashboard/groups?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/groups");
  redirect("/dashboard/groups");
}
