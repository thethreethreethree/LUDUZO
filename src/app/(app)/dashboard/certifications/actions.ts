"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function addCertification(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const staff_id = String(formData.get("staff_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const issuer = String(formData.get("issuer") ?? "").trim() || null;
  const issued_on = String(formData.get("issued_on") ?? "").trim() || null;
  const expires_on = String(formData.get("expires_on") ?? "").trim() || null;
  if (!organization_id || !staff_id || !name) {
    redirect("/dashboard/certifications?error=" + encodeURIComponent("Staff and certification name are required."));
  }
  const { error } = await supabase
    .from("staff_certifications")
    .insert({ organization_id, staff_id, name, issuer, issued_on, expires_on });
  if (error) redirect("/dashboard/certifications?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}

export async function deleteCertification(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/certifications");
  const { error } = await supabase.from("staff_certifications").delete().eq("id", id);
  if (error) redirect("/dashboard/certifications?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/certifications");
  redirect("/dashboard/certifications");
}
