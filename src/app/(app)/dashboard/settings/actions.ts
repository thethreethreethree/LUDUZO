"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Upload one picked image to the public `brand` bucket and return its public URL.
// Shared by the main logo and the dedicated PWA app icon — identical logic. Returns
// {} when no file was picked (caller keeps the existing value). Old files are NOT
// deleted (installed PWAs / cached manifests reference them by URL; deleting 404s
// their icon).
async function uploadBrandImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  file: FormDataEntryValue | null,
  kind: string,
): Promise<{ url?: string; error?: string }> {
  if (!(file instanceof File) || file.size === 0) return {};
  if (!file.type.startsWith("image/")) return { error: "must be an image file." };
  if (file.size > 2_000_000) return { error: "must be under 2 MB." };
  const ext = ((file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "")) || "png";
  const path = `${orgId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("brand").upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { error: "upload failed — " + error.message };
  return { url: supabase.storage.from("brand").getPublicUrl(path).data.publicUrl };
}

export async function updateOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  // Accept only #rrggbb; anything else (blank/invalid) stores null → member webapp
  // falls back to the LUDUZO defaults.
  const hex = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
  };
  const brand_primary = hex(formData.get("brand_primary"));
  const brand_secondary = hex(formData.get("brand_secondary"));
  const brand_background = hex(formData.get("brand_background"));
  if (!id || !name) {
    redirect("/dashboard/settings?error=" + encodeURIComponent("Name is required."));
  }

  // MERGE into the existing settings jsonb — the previous write replaced the whole
  // object, silently wiping phone/address/hours/amenities/cancellation_policy that
  // other pages read from it (A5 ripple-trace). Read-then-merge preserves them.
  const { data: existing } = await supabase.from("organizations").select("settings").eq("id", id).limit(1);
  const prev = (((existing ?? []) as { settings: Record<string, unknown> | null }[])[0]?.settings) ?? {};

  // Main logo (in-app header + PWA fallback) and an OPTIONAL dedicated PWA app icon —
  // same upload logic (RLS restricts writes to the org's own <org_id>/… folder for
  // owner/admin). No new file for a field → keep its existing value.
  let logo_url: string | null = typeof prev.logo_url === "string" ? prev.logo_url : null;
  const logoRes = await uploadBrandImage(supabase, id, formData.get("logo"), "logo");
  if (logoRes.error) redirect("/dashboard/settings?error=" + encodeURIComponent("Logo " + logoRes.error));
  if (logoRes.url) logo_url = logoRes.url;

  let pwa_icon_url: string | null = typeof prev.pwa_icon_url === "string" ? prev.pwa_icon_url : null;
  const iconRes = await uploadBrandImage(supabase, id, formData.get("pwa_logo"), "pwa");
  if (iconRes.error) redirect("/dashboard/settings?error=" + encodeURIComponent("App icon " + iconRes.error));
  if (iconRes.url) pwa_icon_url = iconRes.url;

  const settings = { ...prev, brand_primary, brand_secondary, brand_background, logo_url, pwa_icon_url };

  // RLS (org_update: owner/admin) enforces who may edit the org.
  const { error } = await supabase
    .from("organizations")
    .update({ name, settings })
    .eq("id", id);
  if (error) {
    redirect("/dashboard/settings?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?ok=1");
}
