"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function toggleCouponActive(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) redirect("/dashboard/coupons");
  const { error } = await supabase.from("coupons").update({ active: !active }).eq("id", id);
  if (error) redirect("/dashboard/coupons?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/coupons");
  redirect("/dashboard/coupons");
}

export async function createCoupon(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discount_type = String(formData.get("discount_type") ?? "percent");
  const valueRaw = String(formData.get("discount_value") ?? "").trim();
  // For 'amount', the form is in major units (dollars); store minor units (cents).
  let discount_value = valueRaw && !Number.isNaN(Number(valueRaw)) ? Number(valueRaw) : 0;
  if (discount_type === "amount") discount_value = Math.round(discount_value * 100);
  else discount_value = Math.round(discount_value);

  if (!organization_id || !code) {
    redirect("/dashboard/coupons?error=" + encodeURIComponent("Gym and code are required."));
  }
  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    redirect("/dashboard/coupons?error=" + encodeURIComponent("Enter a discount value greater than zero."));
  }
  if (discount_type === "percent" && discount_value > 100) {
    redirect("/dashboard/coupons?error=" + encodeURIComponent("A percentage discount can't exceed 100%."));
  }
  const { error } = await supabase
    .from("coupons")
    .insert({ organization_id, code, discount_type, discount_value });
  if (error) {
    // unique (organization_id, code) — 0010.
    const msg = isUniqueViolation(error) ? "A coupon with that code already exists." : error.message;
    redirect("/dashboard/coupons?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/coupons");
  redirect("/dashboard/coupons");
}
