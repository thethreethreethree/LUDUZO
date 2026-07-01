"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/members", label: "Members" },
  { href: "/dashboard/checkins", label: "Check-ins" },
  { href: "/dashboard/classes", label: "Classes" },
  { href: "/dashboard/plans", label: "Plans" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/activity", label: "Activity" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active =
          n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={active ? "font-medium text-gold" : "text-ash hover:text-gold"}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
