"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal", label: "Home", icon: "⌂" },
  { href: "/portal/book", label: "Book", icon: "◲" },
  { href: "/portal/progress", label: "Progress", icon: "📈" },
  { href: "/portal/more", label: "More", icon: "☰" },
];

export function PortalTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-iron bg-black/92 px-4 py-2 backdrop-blur">
      <Tab {...TABS[0]} active={pathname === "/portal"} />
      <Tab {...TABS[1]} active={pathname.startsWith("/portal/book")} />
      <Link
        href="/portal"
        aria-label="Arena Pass"
        className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gold text-2xl text-black shadow-[0_0_20px_rgba(245,197,24,0.5)]"
      >
        ▢
      </Link>
      <Tab {...TABS[2]} active={pathname.startsWith("/portal/progress")} />
      <Tab {...TABS[3]} active={pathname.startsWith("/portal/more")} />
    </nav>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${active ? "text-gold" : "text-ash-dim"}`}>
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  );
}
