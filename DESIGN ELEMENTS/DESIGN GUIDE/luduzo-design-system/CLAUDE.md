# CLAUDE.md — Luduzo UI rules

> Append this to your repo's root `CLAUDE.md` (or import it). Claude Code reads this on every task. These rules govern all UI work. **Read `design-system/DESIGN_GUIDELINES.md` before building or editing any screen.**

## Non-negotiables

1. **Use tokens only.** Never hardcode hex values in components. Use the Tailwind classes (`bg-onyx`, `text-gold`, `border-iron`) or CSS vars (`var(--gold)`). If a needed value isn't a token, stop and add it to `tokens.css` + `tailwind.config.js` first — don't inline it.
2. **Dark-first.** Background is `black` (`#0A0A0A`). Cards are `onyx`. Primary text is `bone` (`#EDEDED`) — never `#FFFFFF`. No light theme.
3. **Gold discipline.** `gold` (`#F5C518`) is only for: primary CTA, active nav, live/active indicators, occupancy fills, attention alerts. Max **one** gold button per action group. Gold buttons use **black** text.
4. **Data before nav.** Every screen leads with its most important live data + one hero element. Never open a screen with a flat wall of equal-weight links; group secondary nav into a labeled directory.
5. **Numbers use `font-mono`** (JetBrains Mono): currency, IDs, counts, timestamps, streaks.
6. **Status = dot + label**, never color alone. Active=`win`, At risk=`warn`, Overdue=`loss`, Frozen=`ash`.
7. **Motion is minimal.** Only the approved animations (pulse on live dots, scanner sweep, 120–150ms hover). No decorative/parallax/stagger effects. Honor `prefers-reduced-motion`.
8. **Accessibility:** ≥4.5:1 contrast for real text, ≥40px touch targets, 2px gold focus ring, don't rely on color alone.

## When building a new screen, in order
1. Identify the **one question** the screen answers and the **one hero** element.
2. Place live data/status at the top.
3. Use existing components from `components/ui/` (see the component library). Compose, don't reinvent.
4. Group any module/navigation links into a labeled, secondary directory at the bottom.
5. Write real-looking copy and numbers (see Voice section of the guidelines). No `Lorem`, no bare `0`.
6. Make it responsive: admin desktop-first collapsing to single column; PWA phone-native with bottom tab bar.

## Arena vocabulary (use sparingly, only where natural)
"In the arena now" (occupancy) · "Arena Pass" (member QR) · "Arena scanner" (front desk) · "Gladiator Games" (challenges) · plan tiers "Rookie / Warrior / Gladiator".

## Anti-patterns to reject
- Brightest element on the least useful number.
- Every module the same visual weight.
- New accent colors outside the token set.
- Pure white text / pure black cards.
- More than one gold CTA in a group.
- Inline hex values.

## Files
- `design-system/DESIGN_GUIDELINES.md` — full spec (read first)
- `design-system/tokens.css` — CSS variables + base reset
- `design-system/tailwind.config.js` — palette wired into Tailwind
- `components/ui/` — canonical React components (Button, Card, StatBlock, StatusPill, PlanBadge, AlertItem, DataTable)
