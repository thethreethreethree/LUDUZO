"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateOrgSettings(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = String(formData.get("organization_id") ?? "");
  const brand_color = String(formData.get("brand_color") ?? "").trim() || null;
  const accent_color = String(formData.get("accent_color") ?? "").trim() || null;
  const logo_url = String(formData.get("logo_url") ?? "").trim() || null;
  const plan_tier = String(formData.get("plan_tier") ?? "free");
  const default_currency = String(formData.get("default_currency") ?? "USD").trim().toUpperCase() || "USD";
  const locale = String(formData.get("locale") ?? "en").trim() || "en";
  if (!id) redirect("/dashboard/admin");
  const { error } = await supabase
    .from("organizations")
    .update({ brand_color, accent_color, logo_url, plan_tier, default_currency, locale })
    .eq("id", id);
  if (error) redirect("/dashboard/admin?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin?ok=" + encodeURIComponent("Settings saved."));
}

export async function generateApiKey(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "API key";
  if (!organization_id) redirect("/dashboard/admin");
  const token = "lz_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const key_prefix = token.slice(0, 10);
  const { error } = await supabase.from("api_keys").insert({ organization_id, name, key_prefix, token });
  if (error) redirect("/dashboard/admin?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/admin");
  // Surface the full token once (the only time it's shown).
  redirect("/dashboard/admin?ok=" + encodeURIComponent("API key created: " + token));
}

export async function revokeApiKey(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/admin");
  const { error } = await supabase.from("api_keys").update({ revoked: true }).eq("id", id);
  if (error) redirect("/dashboard/admin?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}

export async function addWebhook(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const organization_id = String(formData.get("organization_id") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const events = String(formData.get("event_types") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!organization_id || !url) redirect("/dashboard/admin?error=" + encodeURIComponent("Webhook URL is required."));
  const { error } = await supabase.from("webhooks").insert({ organization_id, url, event_types: events });
  if (error) redirect("/dashboard/admin?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}

export async function deleteWebhook(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/dashboard/admin");
  const { error } = await supabase.from("webhooks").delete().eq("id", id);
  if (error) redirect("/dashboard/admin?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard/admin");
  redirect("/dashboard/admin");
}
