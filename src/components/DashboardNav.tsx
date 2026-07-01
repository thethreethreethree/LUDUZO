"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_NAV } from "@/lib/nav";

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <>
      {TOP_NAV.map((n) => {
        const active =
          n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`text-sm font-semibold transition-colors duration-150 ${active ? "text-gold" : "text-ash hover:text-bone"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
