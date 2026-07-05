"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCommission(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const staff_user_id = String(formData.get("staff_user_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const amtRaw = String(formData.get("amount") ?? "").trim();
  const amount_cents = amtRaw && !Number.isNaN(Number(amtRaw)) ? Math.round(Number(amtRaw) * 100) : 0;

  if (!organization_id || !staff_user_id) {
    redirect("/dashboard/payroll?error=" + encodeURIComponent("Gym and staff member are required."));
  }
  // Friendly guard for a non-positive amount (the DB check(amount_cents>=0) would
  // otherwise surface a raw Postgres constraint error to the user).
  if (!Number.isFinite(amount_cents) || amount_cents <= 0) {
    redirect("/dashboard/payroll?error=" + encodeURIComponent("Enter a commission amount greater than zero."));
  }
  // RLS (commissions_write: owner/admin/manager) enforces who can create.
  const { error } = await supabase
    .from("commissions")
    .insert({ organization_id, staff_user_id, amount_cents, reason });
  if (error) redirect("/dashboard/payroll?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/payroll");
  redirect("/dashboard/payroll");
}
