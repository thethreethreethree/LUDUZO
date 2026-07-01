"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateReferralStatus(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) redirect("/dashboard/referrals");
  const { error } = await supabase.from("referrals").update({ status }).eq("id", id);
  if (error) redirect("/dashboard/referrals?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/referrals");
  redirect("/dashboard/referrals");
}

export async function createReferral(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const referred_name = String(formData.get("referred_name") ?? "").trim();
  const referred_email = String(formData.get("referred_email") ?? "").trim() || null;
  const referrer_member_id = String(formData.get("referrer_member_id") ?? "") || null;

  if (!organization_id || !referred_name) {
    redirect("/dashboard/referrals?error=" + encodeURIComponent("Gym and referred name are required."));
  }

  const { error } = await supabase
    .from("referrals")
    .insert({ organization_id, referred_name, referred_email, referrer_member_id });
  if (error) {
    redirect("/dashboard/referrals?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/dashboard/referrals");
  redirect("/dashboard/referrals");
}
