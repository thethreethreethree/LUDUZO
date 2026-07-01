"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createInvoice(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organization_id = String(formData.get("organization_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount_cents =
    amountRaw && !Number.isNaN(Number(amountRaw)) ? Math.round(Number(amountRaw) * 100) : 0;
  const due_date = String(formData.get("due_date") ?? "").trim() || null;

  if (!organization_id || amount_cents <= 0) {
    redirect("/dashboard/invoices?error=" + encodeURIComponent("Gym and a positive amount are required."));
  }

  const { error } = await supabase
    .from("invoices")
    .insert({ organization_id, amount_cents, due_date, status: "open" });
  if (error) {
    redirect("/dashboard/invoices?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function voidInvoice(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/invoices");
  const { error } = await supabase.from("invoices").update({ status: "void" }).eq("id", id);
  if (error) redirect("/dashboard/invoices?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function markInvoicePaid(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/invoices");

  // status -> 'paid' emits an invoice.paid event (migration 0005 trigger).
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    redirect("/dashboard/invoices?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
