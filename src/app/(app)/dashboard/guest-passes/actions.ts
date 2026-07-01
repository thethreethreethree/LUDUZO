"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateGuestPassStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) redirect("/dashboard/guest-passes");
  const patch: Record<string, unknown> = { status };
  if (status === "redeemed") patch.redeemed_at = new Date().toISOString();
  const { error } = await supabase.from("guest_passes").update(patch).eq("id", id);
  if (error) redirect("/dashboard/guest-passes?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/guest-passes");
  redirect("/dashboard/guest-passes");
}

export async function issueGuestPass(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const guest_name = String(formData.get("guest_name") ?? "").trim();
  const guest_email = String(formData.get("guest_email") ?? "").trim() || null;
  const host_member_id = String(formData.get("host_member_id") ?? "") || null;
  const expires_at = String(formData.get("expires_at") ?? "").trim() || null;

  if (!organization_id || !guest_name) {
    redirect("/dashboard/guest-passes?error=" + encodeURIComponent("Gym and guest name are required."));
  }

  // App-level code; no format is enforced at the DB yet (see migration 0003 note).
  const code = randomUUID().slice(0, 8).toUpperCase();

  const { error } = await supabase
    .from("guest_passes")
    .insert({ organization_id, guest_name, guest_email, code, host_member_id, expires_at });
  if (error) {
    redirect("/dashboard/guest-passes?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/guest-passes");
  redirect("/dashboard/guest-passes");
}
