"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/announcements");
  // RLS (announcements_write) enforces that only management can delete.
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) redirect("/dashboard/announcements?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/announcements");
  redirect("/dashboard/announcements");
}

export async function postAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  if (!organization_id || !title) {
    redirect("/dashboard/announcements?error=" + encodeURIComponent("Gym and title are required."));
  }

  // RLS (announcements_write: owner/admin/manager) enforces who can post.
  const { error } = await supabase
    .from("announcements")
    .insert({ organization_id, title, body, created_by: user.id });
  if (error) {
    redirect("/dashboard/announcements?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/announcements");
  redirect("/dashboard/announcements");
}
