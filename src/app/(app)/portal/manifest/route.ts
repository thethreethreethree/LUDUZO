import { okHex, DEFAULT_BACKGROUND } from "@/lib/gymTheme";

export const dynamic = "force-dynamic";

// Per-gym PWA manifest. When a member installs the app it's branded as THEIR gym:
// the gym's name + logo (as the app icon) + background colour. The branding is passed
// as query params by the (authenticated) portal layout — NOT read from the session
// here, because a manifest fetch does not reliably send cookies. The params are the
// gym's PUBLIC branding, so there's nothing sensitive to leak, and a crafted URL only
// affects the requester's own install. Falls back to LUDUZO defaults.
//
// Served at /portal/manifest (no .webmanifest extension) so the service worker treats
// it as a page = network, never cached stale across gyms.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") || "Luduzo — Member").slice(0, 60);
  const logo = url.searchParams.get("logo");
  const background = okHex(url.searchParams.get("bg")) || DEFAULT_BACKGROUND;

  // The gym's logo becomes the installed-app icon — but pointed at /portal/icon, which
  // RENDERS a guaranteed 192/512 square PNG from the (arbitrary-size) upload. Pointing
  // the manifest straight at the raw upload let Android/iOS reject a non-square/odd-
  // format image and fall back to the LUDUZO static icons (the "reverts to LUDUZO"
  // bug). A real PNG at the declared size can't be rejected. No logo → LUDUZO defaults.
  const iconUrl = (px: number) =>
    `/portal/icon?s=${px}&logo=${encodeURIComponent(logo!)}&bg=${encodeURIComponent(background)}`;
  const isSvg = logo ? /\.svg(\?|$)/i.test(logo) : false;
  const icons = logo
    ? isSvg
      ? // SVG is already a scalable, valid icon — serve it directly.
        [
          { src: logo, sizes: "any", type: "image/svg+xml", purpose: "any" as const },
          { src: logo, sizes: "any", type: "image/svg+xml", purpose: "maskable" as const },
        ]
      : [
          { src: iconUrl(192), sizes: "192x192", type: "image/png", purpose: "any" as const },
          { src: iconUrl(512), sizes: "512x512", type: "image/png", purpose: "any" as const },
          { src: iconUrl(512), sizes: "512x512", type: "image/png", purpose: "maskable" as const },
        ]
    : [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" as const },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" as const },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" as const },
      ];

  const manifest = {
    id: "/portal",
    name,
    short_name: name.slice(0, 24),
    description: "Your Arena Pass, classes, streaks and progress.",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: background,
    background_color: background,
    categories: ["health", "fitness", "lifestyle"],
    icons,
    shortcuts: [
      { name: "Arena Pass", short_name: "Pass", url: "/portal" },
      { name: "Book a class", short_name: "Book", url: "/portal/book" },
      { name: "Progress", short_name: "Progress", url: "/portal/progress" },
    ],
  };

  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Never serve a stale manifest — otherwise a cached (pre-logo) response keeps
      // showing the LUDUZO default icon after a gym sets its own.
      "cache-control": "no-store, max-age=0, must-revalidate",
    },
  });
}
