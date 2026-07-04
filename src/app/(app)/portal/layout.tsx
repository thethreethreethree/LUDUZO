import type { Metadata } from "next";
import { PortalTabBar } from "@/components/PortalTabBar";
import { PWARegister } from "@/components/PWARegister";
import { createClient } from "@/lib/supabase/server";
import { okHex, textColors, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BACKGROUND } from "@/lib/gymTheme";

// The member PWA is client-branded: point the manifest at the per-gym route (with the
// gym's public branding in the query so the manifest fetch needs no session), and set
// the installed-app title to the gym's name. Falls back to LUDUZO defaults.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let gymName = "Luduzo";
  let manifest = "/site.webmanifest";
  let appleIcon: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("members")
      .select("organization:organizations(name, settings)")
      .eq("profile_id", user.id)
      .limit(1);
    const org = ((data ?? []) as unknown as { organization: { name: string; settings: Record<string, string> | null } | null }[])[0]?.organization ?? null;
    if (org?.name) {
      gymName = org.name;
      const s = org.settings ?? {};
      const params = new URLSearchParams({ name: gymName });
      // PWA/app icon prefers a dedicated app-icon upload, else the main logo.
      const icon = (typeof s.pwa_icon_url === "string" && s.pwa_icon_url) || (typeof s.logo_url === "string" && s.logo_url) || null;
      if (icon) { params.set("logo", icon); appleIcon = icon; }
      if (okHex(s.brand_background)) params.set("bg", okHex(s.brand_background)!);
      manifest = "/portal/manifest?" + params.toString();
    }
  }
  return {
    manifest,
    title: gymName,
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: gymName },
    // iOS home-screen icon comes from apple-touch-icon (not the manifest); point it at
    // the gym's logo so iOS installs are client-branded too.
    ...(appleIcon ? { icons: { apple: appleIcon } } : {}),
  };
}

// Per-gym theming: the owner sets Primary/Secondary/Background + logo in dashboard
// settings; the member webapp reflects them here. Because the Tailwind theme uses
// `@theme inline` (literal colour values baked into utilities), a CSS-variable
// override won't retheme — so we ship a SCOPED stylesheet that overrides exactly the
// branded utilities the member app uses (accent = gold*, surface = onyx*, canvas).
// Colours are validated #rrggbb before injection (no CSS-injection surface).
//
// Known v1 gaps (flagged, not silent): the Arena Pass hero's subtle bg gradient
// (.gold-gradient) and the app-level top loading bar don't retheme; light Background/
// Secondary reduce text legibility (the app is dark-themed).

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let primary = DEFAULT_PRIMARY;
  let secondary = DEFAULT_SECONDARY;
  let background = DEFAULT_BACKGROUND;
  let logo: string | null = null;
  let gymName = "";

  if (user) {
    const { data } = await supabase
      .from("members")
      .select("organization:organizations(name, settings)")
      .eq("profile_id", user.id)
      .limit(1);
    const org = ((data ?? []) as unknown as { organization: { name: string; settings: Record<string, string> | null } | null }[])[0]?.organization ?? null;
    if (org) {
      const s = org.settings ?? {};
      primary = okHex(s.brand_primary) ?? okHex(s.brand_color) ?? primary;
      secondary = okHex(s.brand_secondary) ?? secondary;
      background = okHex(s.brand_background) ?? background;
      logo = (typeof s.logo_url === "string" && s.logo_url) || null;
      gymName = org.name ?? "";
    }
  }

  // Legible text per surface (page background vs cards) — shared math with the preview.
  const { bg: bgText, card: cardText, onPrimary } = textColors(primary, secondary, background);

  // Scoped override of the branded utilities the member app actually uses (enumerated
  // from the portal). Selector specificity (.gym-theme .x) beats the base utility, so
  // no !important is needed. Backslashes escape Tailwind's `/` and `:` in class names.
  const css = `
body{background:${background};--nav-progress-bg:linear-gradient(90deg,color-mix(in srgb,${primary} 75%,black) 0%,${primary} 45%,color-mix(in srgb,${primary} 55%,white) 100%);--nav-progress-glow:0 0 14px 2px color-mix(in srgb,${primary} 85%,transparent),0 1px 0 rgba(255,255,255,0.35) inset;}
.gym-theme{background:${background};min-height:100dvh;--glow-strong:color-mix(in srgb,${primary} 50%,transparent);--glow-soft:color-mix(in srgb,${primary} 25%,transparent);}
.gym-theme .ring-gold{--tw-ring-color:${primary};}
.gym-theme .gold-gradient{background:linear-gradient(160deg,color-mix(in srgb,${primary} 10%,${secondary}),${secondary});}
.gym-theme .gold-fill{background:linear-gradient(90deg,${primary},color-mix(in srgb,${primary} 65%,black));}
.gym-theme .bg-onyx{background-color:${secondary};}
.gym-theme .bg-onyx-2{background-color:color-mix(in srgb,${secondary} 88%,white);}
.gym-theme .text-gold{color:${primary};}
.gym-theme .bg-gold{background-color:${primary};}
.gym-theme .bg-gold\\/10{background-color:color-mix(in srgb,${primary} 10%,transparent);}
.gym-theme .bg-gold-dim{background-color:color-mix(in srgb,${primary} 14%,transparent);}
.gym-theme .border-gold{border-color:${primary};}
.gym-theme .border-gold-line{border-color:color-mix(in srgb,${primary} 35%,transparent);}
.gym-theme .hover\\:text-gold:hover{color:${primary};}
.gym-theme .hover\\:border-gold:hover{border-color:${primary};}
.gym-theme .bg-black\\/92{background-color:color-mix(in srgb,${background} 92%,transparent);}
.gym-theme .text-bone{color:${bgText.text};}
.gym-theme .text-ash{color:${bgText.textSec};}
.gym-theme .bg-onyx .text-bone,.gym-theme .bg-onyx-2 .text-bone,.gym-theme .gold-gradient .text-bone{color:${cardText.text};}
.gym-theme .bg-onyx .text-ash,.gym-theme .bg-onyx-2 .text-ash,.gym-theme .gold-gradient .text-ash{color:${cardText.textSec};}
.gym-theme .text-black{color:${onPrimary};}
`.trim();

  return (
    <div className="gym-theme">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Gym logo + name, top-right of the member webapp. */}
      {(logo || gymName) ? (
        <div className="mx-auto flex max-w-md items-center justify-end gap-3 px-5 pt-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-14 w-14 rounded object-cover" />
          ) : null}
          {gymName ? <span className="text-2xl font-extrabold text-bone">{gymName}</span> : null}
        </div>
      ) : null}

      <div className="mx-auto max-w-md px-5 pt-2"><PWARegister gymName={gymName || "Luduzo"} /></div>
      {children}
      <PortalTabBar />
    </div>
  );
}
