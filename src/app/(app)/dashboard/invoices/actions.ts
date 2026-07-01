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

// Phase 4: record a refund against an invoice (record-only; no card processing).
export async function recordRefund(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const invoice_id = String(formData.get("invoice_id") ?? "") || null;
  const member_id = String(formData.get("member_id") ?? "") || null;
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount_cents = amountRaw ? Math.round(Number(amountRaw) * 100) : 0;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!organization_id || !amount_cents) {
    redirect("/dashboard/invoices?error=" + encodeURIComponent("Amount is required."));
  }
  const { error } = await supabase
    .from("refunds")
    .insert({ organization_id, invoice_id, member_id, amount_cents, reason, created_by: user.id });
  if (error) redirect("/dashboard/invoices?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices?ok=" + encodeURIComponent("Refund recorded."));
}

// Phase 4: auto-suspension — freeze active members with past_due invoices.
export async function suspendOverdue(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  if (!organization_id) redirect("/dashboard/invoices");
  const { data, error } = await supabase.rpc("suspend_overdue_members", { p_org: organization_id });
  if (error) redirect("/dashboard/invoices?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices?ok=" + encodeURIComponent(`${data ?? 0} member(s) suspended for past-due balances.`));
}
