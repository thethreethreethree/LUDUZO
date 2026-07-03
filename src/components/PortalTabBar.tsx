"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/portal", label: "Home", icon: "home" },
  { href: "/portal/book", label: "Book", icon: "schedule" },
  { href: "/portal/progress", label: "Progress", icon: "progress" },
  { href: "/portal/more", label: "More", icon: "more" },
];

export function PortalTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-iron bg-black/92 px-4 py-2 backdrop-blur">
      <Tab {...TABS[0]} active={pathname === "/portal"} />
      <Tab {...TABS[1]} active={pathname.startsWith("/portal/book")} />
      <Link
        href="/portal/pass"
        aria-label="Arena Pass"
        aria-current={pathname.startsWith("/portal/pass") ? "page" : undefined}
        className={`-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gold text-black shadow-[0_0_20px_var(--glow-strong)] ${pathname.startsWith("/portal/pass") ? "ring-2 ring-gold ring-offset-2 ring-offset-black" : ""}`}
      >
        <Icon name="pass" size={26} />
      </Link>
      <Tab {...TABS[2]} active={pathname.startsWith("/portal/progress")} />
      <Tab {...TABS[3]} active={pathname.startsWith("/portal/more")} />
    </nav>
  );
}

function Tab({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${active ? "text-gold" : "text-ash-dim"}`}>
      <Icon name={icon} size={20} />
      {label}
    </Link>
  );
}
