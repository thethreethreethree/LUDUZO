"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleTemplateActive(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect("/dashboard/documents");
  const { error } = await supabase.from("document_templates").update({ active: !active }).eq("id", id);
  if (error) redirect("/dashboard/documents?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/documents");
  redirect("/dashboard/documents");
}

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "waiver");
  const body = String(formData.get("body") ?? "").trim() || null;

  if (!organization_id || !title) {
    redirect("/dashboard/documents?error=" + encodeURIComponent("Gym and title are required."));
  }

  const { error } = await supabase
    .from("document_templates")
    .insert({ organization_id, title, kind, body });
  if (error) {
    redirect("/dashboard/documents?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/documents");
  redirect("/dashboard/documents");
}
