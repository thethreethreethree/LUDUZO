import { ImageResponse } from "next/og";
import { okHex, DEFAULT_BACKGROUND } from "@/lib/gymTheme";

export const dynamic = "force-dynamic";

// Generates a GUARANTEED-VALID square PNG app icon from the gym's (arbitrary-size)
// uploaded logo, composed on the gym's background at the exact pixel size the OS asks
// for. Previous attempts pointed the manifest / apple-touch-icon straight at the raw
// upload; if that image wasn't a real 192/512 square, Android/iOS REJECTED it and fell
// back to the auto-served LUDUZO /favicon.ico and /apple-touch-icon.png (the "reverts
// to LUDUZO" bug). A real PNG at the declared size can't be rejected.
//
// Public (exempted in middleware) because the OS fetches icons without the session
// cookie. Params are the gym's public branding — nothing sensitive.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const logo = url.searchParams.get("logo");
  const bg = okHex(url.searchParams.get("bg")) || DEFAULT_BACKGROUND;
  const size = Math.min(1024, Math.max(48, parseInt(url.searchParams.get("s") || "512", 10) || 512));

  // SSRF guard: this route is public and fetches `logo` server-side, so pin it to the
  // gym's own Supabase public storage (where the `brand` bucket lives). Without this,
  // any caller could make the server fetch an arbitrary internal URL.
  const allowedPrefix = `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1/object/public/`;
  if (!logo || !process.env.NEXT_PUBLIC_SUPABASE_URL || !logo.startsWith(allowedPrefix)) {
    return new Response("Not found", { status: 404 });
  }

  const pad = Math.round(size * 0.12);
  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} width={size - pad * 2} height={size - pad * 2} style={{ objectFit: "contain" }} alt="" />
    </div>
  );
  return new ImageResponse(element, {
    width: size,
    height: size,
    headers: { "cache-control": "public, max-age=3600" },
  });
}
