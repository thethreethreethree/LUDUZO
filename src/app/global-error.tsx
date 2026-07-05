"use client";

// Root-level crash boundary: renders only when the ROOT layout itself throws — the one
// error the segment boundaries (dashboard/ and portal/ error.tsx) cannot catch. Because
// it REPLACES the root layout, it inherits none of the app's globals.css or fonts, so
// every style here is inline and self-contained (Tailwind classes would silently no-op).
// A root crash is a platform-level failure above the point where a gym's theme is known,
// so this carries LUDUZO (SaaS) branding, not a gym's. Message only — never error.message
// (could carry internal detail); the digest is a safe hash for support correlation.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "32px",
          textAlign: "center",
          background: "#0a0a0a",
          color: "#e7e5e4",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ fontWeight: 800, letterSpacing: "0.18em", color: "#f5c518", fontSize: "14px" }}>
          LUDUZO
        </div>
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: "22rem", fontSize: "14px", color: "#a8a29e", lineHeight: 1.5 }}>
          We hit an unexpected error. Please try again — if it keeps happening, refresh the
          page in a moment.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "8px",
            padding: "10px 18px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#0a0a0a",
            background: "#f5c518",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: "12px", color: "#78716c" }}>Reference: {error.digest}</p>
        ) : null}
      </body>
    </html>
  );
}
