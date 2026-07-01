import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  openGraph: {
    title: "LUDUZO — Gym management, reforged",
    description: "Memberships, classes, billing, and check-ins in one command center.",
    images: ["/brand/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${montserrat.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
