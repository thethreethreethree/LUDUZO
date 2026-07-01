"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUniqueViolation } from "@/lib/pg-errors";

export async function issueGiftCard(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const cents = amountRaw ? Math.round(Number(amountRaw) * 100) : 0;
  const issued_to_member = String(formData.get("issued_to_member") ?? "") || null;
  if (!organization_id || !code || !cents) redirect("/dashboard/gift-cards?error=" + encodeURIComponent("Code and amount are required."));
  const { error } = await supabase.from("gift_cards").insert({
    organization_id, code, initial_cents: cents, balance_cents: cents, issued_to_member,
  });
  if (error) {
    const msg = isUniqueViolation(error) ? "A gift card with that code already exists." : error.message;
    redirect("/dashboard/gift-cards?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/dashboard/gift-cards");
  redirect("/dashboard/gift-cards");
}

export async function deactivateGiftCard(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/gift-cards");
  const { error } = await supabase.from("gift_cards").update({ active: false }).eq("id", id);
  if (error) redirect("/dashboard/gift-cards?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/gift-cards");
  redirect("/dashboard/gift-cards");
}
