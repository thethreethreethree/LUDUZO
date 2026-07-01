"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function rentLocker(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const locker_label = String(formData.get("locker_label") ?? "").trim();
  const member_id = String(formData.get("member_id") ?? "") || null;
  const feeRaw = String(formData.get("monthly_fee") ?? "").trim();
  const monthly_fee_cents = feeRaw ? Math.round(Number(feeRaw) * 100) : 0;
  const starts_on = String(formData.get("starts_on") ?? "").trim() || null;
  const ends_on = String(formData.get("ends_on") ?? "").trim() || null;
  if (!organization_id || !locker_label) redirect("/dashboard/lockers?error=" + encodeURIComponent("Locker label is required."));
  const { error } = await supabase.from("locker_rentals").insert({ organization_id, locker_label, member_id, monthly_fee_cents, starts_on, ends_on });
  if (error) redirect("/dashboard/lockers?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/lockers");
  redirect("/dashboard/lockers");
}

export async function endLockerRental(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/lockers");
  const { error } = await supabase.from("locker_rentals").update({ status: "ended" }).eq("id", id);
  if (error) redirect("/dashboard/lockers?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/lockers");
  redirect("/dashboard/lockers");
}
