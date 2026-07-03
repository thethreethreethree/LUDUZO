"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Logo: upload the picked image to the public `brand` bucket (0061) and store its
  // URL. No new file → keep the existing logo. RLS restricts writes to the org's own
  // <org_id>/… folder for owner/admin. Uploaded via the caller's session (RLS applies).
  let logo_url: string | null = typeof prev.logo_url === "string" ? prev.logo_url : null;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      redirect("/dashboard/settings?error=" + encodeURIComponent("Logo must be an image file."));
    }
    if (file.size > 2_000_000) {
      redirect("/dashboard/settings?error=" + encodeURIComponent("Logo must be under 2 MB."));
    }
    const ext = ((file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "")) || "png";
    const path = `${id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("brand").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      redirect("/dashboard/settings?error=" + encodeURIComponent("Logo upload failed — " + upErr.message));
    }
    logo_url = supabase.storage.from("brand").getPublicUrl(path).data.publicUrl;
  }

  const settings = { ...prev, brand_primary, brand_secondary, brand_background, logo_url };

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
