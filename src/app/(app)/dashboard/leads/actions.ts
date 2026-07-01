"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STAGES } from "@/lib/crm";

export async function createLead(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "").trim() || null;
  if (!organization_id || !name) redirect("/dashboard/leads?error=" + encodeURIComponent("Gym and name are required."));
  const { error } = await supabase.from("leads").insert({ organization_id, name, email, phone, source, owner_id: user.id });
  if (error) redirect("/dashboard/leads?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/leads");
}

export async function updateLeadStage(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !LEAD_STAGES.includes(stage as (typeof LEAD_STAGES)[number])) redirect("/dashboard/leads");
  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) redirect("/dashboard/leads?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/leads");
}

// Convert a lead into a member (splits name into first/last), marks the lead 'won'.
export async function convertLead(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!id || !organization_id || !name) redirect("/dashboard/leads");
  const parts = name.split(/\s+/);
  const first_name = parts[0];
  const last_name = parts.slice(1).join(" ") || parts[0];
  const { data: mem, error: mErr } = await supabase
    .from("members")
    .insert({ organization_id, first_name, last_name, email, phone })
    .select("id")
    .single();
  if (mErr) redirect("/dashboard/leads?error=" + encodeURIComponent(mErr.message));
  await supabase.from("leads").update({ stage: "won", converted_member_id: (mem as { id: string }).id }).eq("id", id);
  revalidatePath("/dashboard/leads");
  redirect(`/dashboard/members/${(mem as { id: string }).id}?ok=` + encodeURIComponent("Lead converted to member."));
}
