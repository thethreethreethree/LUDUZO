import type { Metadata } from "next";
import { Suspense } from "react";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavigationProgress } from "@/components/NavigationProgress";

// Display + UI + body face (design guide §3: Montserrat 500–900, no separate body face).
const montserrat = Montserrat({
  variable: "--font-montserrat",
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// Numbers: currency, IDs, counts, timestamps, streaks (design guide §3).
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUDUZO — Run your gym like an arena",
  description:
    "Multi-tenant gym management. Memberships, classes, billing, and check-ins in one command center.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Luduzo" },
  openGraph: {
    title: "LUDUZO — Gym management, reforged",
    description: "Memberships, classes, billing, and check-ins in one command center.",
    images: ["/brand/og.png"],
  },
};

// No-flash theme: set `.dark` BEFORE first paint from the saved choice (localStorage)
// or the OS preference, so there's no light/dark flash on load. Runs synchronously in
// <head>; on any error falls back to dark (the brand default). The member portal pins
// its own `.dark`, so this never overrides per-gym branding.
const THEME_SCRIPT = `(function(){try{var e=localStorage.getItem("luduzo-theme"),d=document.documentElement,useDark=e?e==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;d.classList.toggle("dark",useDark);}catch(_){document.documentElement.classList.add("dark");}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${montserrat.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
