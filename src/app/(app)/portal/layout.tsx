import { PortalTabBar } from "@/components/PortalTabBar";
import { PWARegister } from "@/components/PWARegister";
import { createClient } from "@/lib/supabase/server";
import { okHex, textColors, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_BACKGROUND } from "@/lib/gymTheme";

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

  // Legible text against whatever colours were picked (shared math with the settings preview).
  const { textMain, textSec, onPrimary } = textColors(primary, secondary, background);

  // Scoped override of the branded utilities the member app actually uses (enumerated
  // from the portal). Selector specificity (.gym-theme .x) beats the base utility, so
  // no !important is needed. Backslashes escape Tailwind's `/` and `:` in class names.
  const css = `
body{background:${background};}
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
.gym-theme .text-bone{color:${textMain};}
.gym-theme .text-ash{color:${textSec};}
.gym-theme .text-black{color:${onPrimary};}
`.trim();

  return (
    <div className="gym-theme">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Gym logo + name, top-right of the member webapp. */}
      {(logo || gymName) ? (
        <div className="mx-auto flex max-w-md items-center justify-end gap-2 px-5 pt-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-7 w-7 rounded object-cover" />
          ) : null}
          {gymName ? <span className="text-sm font-bold text-bone">{gymName}</span> : null}
        </div>
      ) : null}

      <div className="mx-auto max-w-md px-5 pt-2"><PWARegister /></div>
      {children}
      <PortalTabBar />
    </div>
  );
}
