// ============================================================================
// LUDUZO — canonical UI components (design system). Server-safe (presentational;
// navigation via <Link>). Adapted from DESIGN GUIDE/components-ui.jsx to real data.
// Tokens only — no inline hex. Numbers use the `mono` class (JetBrains Mono).
// ============================================================================
import Link from "next/link";
import type { ReactNode } from "react";

// Button style strings (use on <button> in server-action forms, or <Link>).
export const btnGold =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-gold px-4 py-2.5 text-sm font-bold text-black transition-colors duration-150 hover:bg-gold-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-iron bg-onyx px-4 py-2.5 text-sm font-semibold text-bone transition-colors duration-150 hover:border-iron-2 hover:bg-onyx-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-ash transition-colors duration-150 hover:bg-onyx hover:text-bone";

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-ash">{children}</span>;
}

export function Card({ hero = false, className = "", children }: { hero?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-md border p-5 ${hero ? "gold-gradient border-gold-line" : "border-iron bg-onyx"} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-bold text-bone">{title}</h2>
      {action && href ? (
        <Link href={href} className="text-sm font-semibold text-gold hover:underline">{action}</Link>
      ) : null}
    </div>
  );
}

// Big metric block. hero=true → gold-gradient occupancy treatment.
export function StatBlock({
  label, value, unit, delta, deltaDir, hero = false, children,
}: {
  label: string; value: ReactNode; unit?: string; delta?: string;
  deltaDir?: "up" | "down" | "flat"; hero?: boolean; children?: ReactNode;
}) {
  const deltaColor = deltaDir === "up" ? "text-win" : deltaDir === "down" ? "text-loss" : "text-ash";
  const arrow = deltaDir === "up" ? "▲" : deltaDir === "down" ? "▼" : "";
  return (
    <div className={`rounded-md border p-5 ${hero ? "gold-gradient border-gold-line" : "border-iron bg-onyx"}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-ash">{label}</div>
      <div className="mono mt-2 text-[34px] font-extrabold leading-none tracking-[-0.02em] text-bone">
        {value}
        {unit ? <span className="ml-1 text-base font-semibold text-ash">{unit}</span> : null}
      </div>
      {delta ? <div className={`mono mt-2 text-xs font-semibold ${deltaColor}`}>{arrow} {delta}</div> : null}
      {children}
    </div>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-iron ${className}`}>
      <div className="gold-fill h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

// Colored dot + label — never colour alone (design guide §8).
type StatusKind = "active" | "risk" | "overdue" | "frozen";
const STATUS: Record<StatusKind, { dot: string; text: string; label: string }> = {
  active: { dot: "bg-win", text: "text-win", label: "Active" },
  risk: { dot: "bg-warn", text: "text-warn", label: "At risk" },
  overdue: { dot: "bg-loss", text: "text-loss", label: "Overdue" },
  frozen: { dot: "bg-ash", text: "text-ash", label: "Frozen" },
};
export function StatusPill({ status, live = false, label }: { status: StatusKind; live?: boolean; label?: string }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.text}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${s.dot} ${live ? "animate-[livepulse_2s_infinite]" : ""}`} />
      {label ?? s.label}
    </span>
  );
}

// Map a member status string to a StatusPill kind.
export function memberStatusKind(status: string): StatusKind {
  if (status === "active") return "active";
  if (status === "frozen") return "frozen";
  if (status === "pending") return "risk";
  return "frozen";
}

// Plan badge — renders the real plan name; neutral by default (design's Warrior/
// Gladiator/Rookie are illustrative tiers, not enforced on real plan names).
export function PlanBadge({ label, tier = "neutral" }: { label: string; tier?: "warrior" | "gladiator" | "rookie" | "neutral" }) {
  const styles: Record<string, string> = {
    warrior: "bg-gold-dim text-plan-warrior",
    gladiator: "bg-[rgba(159,122,234,0.15)] text-plan-gladiator",
    rookie: "bg-iron text-plan-rookie",
    neutral: "bg-gold-dim text-gold",
  };
  return <span className={`inline-block rounded-[6px] px-2.5 py-1 text-[11px] font-bold ${styles[tier]}`}>{label}</span>;
}

export function AlertItem({ icon, title, subtext, href }: { icon: ReactNode; title: string; subtext?: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-gold-line bg-gold-dim p-3.5 transition-colors hover:bg-[rgba(245,197,24,0.2)]"
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-sm font-semibold text-bone">
        {title}
        {subtext ? <span className="mt-0.5 block text-xs font-medium text-ash">{subtext}</span> : null}
      </span>
      <span className="text-lg text-gold">→</span>
    </Link>
  );
}

const AVATAR_COLORS = ["#F5C518", "#3FB950", "#B794F4", "#E5534B", "#8A8A8A", "#5B9BD5", "#E3A008"];
export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-black"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.34 }}
    >
      {initials}
    </span>
  );
}
