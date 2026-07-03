import type { ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// LUDUZO icon system — the single source for member-app iconography.
//
// The app used raw system emoji (🦁 🔥 💪 …) that read consumer-casual and fight
// the gold-on-onyx arena identity. This registry is the code form of the icon
// brief: one named slot per concept. Each slot renders its custom SVG when set,
// and falls back to the original emoji until the art lands — so surfaces can
// migrate to <Icon/> NOW and every icon swaps in ONE place later.
//
// Design contract for each SVG (see the icon brief): 24×24 artboard, solid
// silhouette, `fill="currentColor"`, no baked color, angular — matched to
// /brand/luduzo_helmet.svg. Nav icons additionally want an `active` variant.
// ─────────────────────────────────────────────────────────────────────────────

export type IconName =
  // 01 · navigation (tab bar)
  | "home" | "schedule" | "pass" | "progress" | "more"
  // 02 · primary actions
  | "book" | "workout" | "metrics"
  // 03 · journey & gamification
  | "rank" | "streak" | "goal" | "records" | "badges" | "medal"
  // 04 · contact & info
  | "call" | "hours" | "location" | "amenities" | "community"
  // 05 · celebration
  | "victory"
  // 06 · staff dashboard (gym-side). `streak` above is reused in the members table.
  | "document" | "alert";

type IconDef = {
  /** Original emoji — rendered until `svg` is supplied. */
  emoji: string;
  /** Drop the designed 24×24 currentColor SVG here to retire the emoji. */
  svg?: ReactNode;
  /** Human label; used for accessible names when the icon is meaningful. */
  label: string;
};

// When a designed SVG arrives, set `svg: (<path d="…" />)` on that slot — nothing
// else in the app has to change.
export const ICONS: Record<IconName, IconDef> = {
  home:       { emoji: "⌂",  label: "Home" },
  schedule:   { emoji: "◲",  label: "Schedule" },
  pass:       { emoji: "▢",  label: "Arena Pass" },
  progress:   { emoji: "📈", label: "Progress" },
  more:       { emoji: "☰",  label: "More" },
  book:       { emoji: "📅", label: "Book a class" },
  workout:    { emoji: "💪", label: "Log a workout" },
  metrics:    { emoji: "⚖️", label: "Log metrics" },
  rank:       { emoji: "🦁", label: "Rank" },
  streak:     { emoji: "🔥", label: "Streak" },
  goal:       { emoji: "🎯", label: "Goal" },
  records:    { emoji: "🏆", label: "Personal records" },
  badges:     { emoji: "🏅", label: "Badges" },
  medal:      { emoji: "🥇", label: "Rank medal" },
  call:       { emoji: "📞", label: "Call" },
  hours:      { emoji: "🕐", label: "Hours" },
  location:   { emoji: "📍", label: "Location" },
  amenities:  { emoji: "🏋", label: "Amenities" },
  community:  { emoji: "💬", label: "Community" },
  victory:    { emoji: "🎉", label: "Victory" },
  document:   { emoji: "📄", label: "Document" },
  alert:      { emoji: "⚠",  label: "Alert" },
};

export function Icon({
  name,
  size = 20,
  className,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  /** Set for a meaningful icon (adds an accessible label); omit for decorative. */
  title?: string;
}) {
  const def = ICONS[name];
  const a11y = title ? { role: "img", "aria-label": title } : { "aria-hidden": true as const };

  // Real SVG present → render it at the requested size, tinted by currentColor.
  if (def.svg) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
        {...a11y}
      >
        {def.svg}
      </svg>
    );
  }

  // Fallback: original emoji, sized to match, so nothing looks broken pre-art.
  return (
    <span
      className={className}
      style={{ fontSize: size * 0.9, lineHeight: 1, display: "inline-block" }}
      {...a11y}
    >
      {def.emoji}
    </span>
  );
}
