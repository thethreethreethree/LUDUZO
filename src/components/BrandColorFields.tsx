"use client";

import { useState } from "react";
import { textColors } from "@/lib/gymTheme";

// Three colour pickers for the gym's member-app theme, with a LIVE preview that
// applies the exact same theming math the member webapp uses (shared @/lib/gymTheme),
// so the owner sees the result before saving. The inputs keep their `name` so the
// existing server action still receives them.
export function BrandColorFields({
  primary: p0,
  secondary: s0,
  background: b0,
}: {
  primary: string;
  secondary: string;
  background: string;
}) {
  const [primary, setPrimary] = useState(p0);
  const [secondary, setSecondary] = useState(s0);
  const [background, setBackground] = useState(b0);

  const { textMain, textSec, onPrimary } = textColors(primary, secondary, background);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Member app colours</span>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-3">
          {([
            ["brand_primary", "Primary", primary, setPrimary],
            ["brand_secondary", "Secondary", secondary, setSecondary],
            ["brand_background", "Background", background, setBackground],
          ] as const).map(([name, label, value, set]) => (
            <label key={name} className="flex flex-col items-center gap-1 text-xs text-ash">
              <input
                name={name}
                type="color"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-md border border-iron"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {/* Live preview — a mock member card themed exactly like the real app. */}
        <div className="w-44 shrink-0 rounded-lg p-3" style={{ background }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: primary }}>
            ◈ Arena Pass
          </div>
          <div className="mt-2 rounded-md p-2.5" style={{ background: secondary }}>
            <div className="text-[11px] font-bold" style={{ color: textMain }}>Member card</div>
            <div className="text-[10px]" style={{ color: textSec }}>preview of your colours</div>
            <button
              type="button"
              className="mt-2 rounded px-2.5 py-1 text-[10px] font-bold"
              style={{ background: primary, color: onPrimary }}
            >
              Book a class
            </button>
          </div>
        </div>
      </div>
      <span className="text-xs text-ash-dim">
        Primary = accent (buttons, highlights) · Secondary = cards · Background = page. Designed for dark
        backgrounds — light colours reduce text legibility (the preview shows the adjusted text).
      </span>
    </div>
  );
}
