"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TASK_STATUSES } from "@/lib/team";

export async function createTask(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const assigned_to = String(formData.get("assigned_to") ?? "") || null;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;
  const priority = String(formData.get("priority") ?? "normal");
  if (!organization_id || !title) {
    redirect("/dashboard/tasks?error=" + encodeURIComponent("Gym and title are required."));
  }
  const { error } = await supabase
    .from("tasks")
    .insert({ organization_id, title, description, assigned_to, due_date, priority, created_by: user.id });
  if (error) redirect("/dashboard/tasks?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/tasks");
  redirect("/dashboard/tasks");
}

export async function updateTaskStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) redirect("/dashboard/tasks");
  const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
  if (error) redirect("/dashboard/tasks?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/tasks");
  redirect("/dashboard/tasks");
}
