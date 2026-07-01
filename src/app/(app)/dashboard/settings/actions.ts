"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const brand_color = String(formData.get("brand_color") ?? "").trim() || null;
  const logo_url = String(formData.get("logo_url") ?? "").trim() || null;
  if (!id || !name) {
    redirect("/dashboard/settings?error=" + encodeURIComponent("Name is required."));
  }

  // RLS (org_update: owner/admin) enforces who may edit the org.
  const { error } = await supabase
    .from("organizations")
    .update({ name, settings: { brand_color, logo_url } })
    .eq("id", id);
  if (error) {
    redirect("/dashboard/settings?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?ok=1");
}
