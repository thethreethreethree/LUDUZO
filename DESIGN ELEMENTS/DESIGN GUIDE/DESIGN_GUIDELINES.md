# Luduzo — Design System & UI Guidelines

> **Tagline:** Run your gym like an arena.
> **Product:** Gym Management SaaS (owner/admin web app + member-facing PWA)
> **This document is the single source of truth for UI.** Claude Code and human devs should follow it for every screen. When a request conflicts with these rules, follow the rules unless explicitly told otherwise.

---

## 1. Design principles

1. **Data before navigation.** A screen's job is to answer a question ("how's my gym doing right now?", "who's overdue?") before asking the user to click. Lead with live numbers and status, not link directories.
2. **Gold is earned, not sprayed.** Signal gold (`#F5C518`) marks only what deserves action or attention: primary CTAs, live indicators, active nav, occupancy fills, alerts. If everything is gold, nothing is. Aim for **gold on <10% of any screen's surface**.
3. **The arena theme is expressed, not decorated.** Use it in language ("In the arena now", "Arena Pass", "Gladiator Games") and in the one hero moment per screen — never as gratuitous ornament.
4. **One hero per screen.** Each screen has a single most-important element (the QR pass, the live stat band, the scanner). Everything else is secondary.
5. **Dark-first.** The product is a dark UI. Light theme is out of scope for v1.
6. **Mobile matters for members, desktop for admins.** The PWA is phone-native (bottom tab bar, thumb-reachable actions). Admin pages are desktop-first but must collapse gracefully.

---

## 2. Color tokens

| Token | Hex | Use |
|-------|-----|-----|
| `black` | `#0A0A0A` | App background |
| `onyx` | `#161616` | Card / panel background |
| `onyx-2` | `#1C1C1C` | Raised/hover surface, table header |
| `iron` | `#2A2A2A` | Borders, dividers, inactive bars |
| `iron-2` | `#333333` | Hover borders |
| `ash` | `#8A8A8A` | Secondary text, labels |
| `ash-dim` | `#5E5E5E` | Tertiary text, placeholders, disabled |
| `bone` | `#EDEDED` | Primary text (not pure white) |
| `gold` | `#F5C518` | Primary accent — CTAs, active, live, alerts |
| `gold-dim` | `rgba(245,197,24,.14)` | Gold-tinted backgrounds (alert cards, badges) |
| `gold-line` | `rgba(245,197,24,.35)` | Gold borders on highlighted cards |

### Semantic / status colors
| Token | Hex | Meaning |
|-------|-----|---------|
| `win` | `#3FB950` | Success, active, positive delta, checked-in |
| `loss` | `#E5534B` | Error, overdue, negative delta, payment failed |
| `warn` | `#E3A008` | At-risk, needs attention (distinct from brand gold) |

**Rules**
- Primary text is `bone` (`#EDEDED`), **never** pure `#FFFFFF`.
- Never put `gold` text on `bone`/white, or `bone` on `gold` at small sizes — gold buttons use **black** text (`#0A0A0A`).
- `warn` (amber) is for status only; it's intentionally close to gold but must not be used for interactive accents. Keep brand `gold` for actions, `warn` for at-risk state.

### Plan badge colors (member tiers)
| Plan | Text | Background |
|------|------|-----------|
| Warrior | `#F5C518` | `gold-dim` |
| Gladiator | `#B794F4` | `rgba(159,122,234,.15)` |
| Rookie | `ash` | `iron` |

---

## 3. Typography

- **Display / UI font:** `Montserrat` (weights 500, 600, 700, 800, 900).
- **Monospace:** `JetBrains Mono` — for numbers that benefit from tabular alignment (currency, IDs, timestamps, counts, streaks).
- **Body:** Montserrat 500/600 (no separate body face in v1).

### Type scale
| Role | Size | Weight | Notes |
|------|------|--------|-------|
| Page title (`h1`) | 28–30px | 800 | Letter-spacing `-0.02em` |
| Big stat value | 34–38px | 800–900 | Letter-spacing `-0.02em` |
| Section heading (`h2`) | 15–16px | 700–800 | |
| Card title | 15px | 700 | |
| Body | 13–14px | 500–600 | |
| Label / eyebrow | 11–12px | 600–700 | UPPERCASE, letter-spacing `0.06–0.09em`, color `ash` |
| Micro / timestamp | 10–12px | 500–700 | Often `JetBrains Mono`, color `ash` / `ash-dim` |

**Rules**
- Uppercase only for eyebrows/labels, never for body or headings.
- Currency, member IDs (`#LDZ-4417`), counts, and times use `JetBrains Mono`.
- Line-height `1.4` default; `1` for big stat numbers.

---

## 4. Spacing, radius, layout

- **Spacing scale (px):** 4, 8, 10, 12, 14, 16, 20, 22, 28, 32, 36. Prefer these values; avoid arbitrary numbers.
- **Radius:** small `7–10px` (buttons, pills, small tiles), medium `12–14px` (cards, tables), large `18–24px` (hero cards, phone-frame elements), pill `999px`.
- **Content max-width (admin):** `1240px`, centered, `28px` horizontal padding.
- **Card padding:** `16–24px`.
- **Grid gaps:** `12–22px`.
- **Border:** `1px solid iron` on virtually every surface separation. Highlighted cards use `1px solid gold-line`.

---

## 5. Component patterns

### Buttons
- **Primary (`.btn-gold`):** `gold` bg, `black` text, weight 600–700, radius 10px, padding `10–14px 16–18px`. Hover → `#ffd429`.
- **Secondary (`.btn`):** `onyx` bg, `bone` text, `1px iron` border. Hover → `onyx-2` bg, `iron-2` border.
- Never more than **one gold button** in a single toolbar/action group.

### Cards
- Background `onyx`, border `1px iron`, radius `12–14px`.
- Highlighted/hero cards: gradient `linear-gradient(160deg,#1a1a12,var(--onyx))` + `gold-line` border.
- Card header: title (`h2`, 15px/700) left, optional gold "action →" link right.

### Stat / metric block
- Eyebrow label (uppercase, `ash`) → big value (`bone`, 800) → delta line.
- Delta uses `win`/`loss` with `▲`/`▼` and `JetBrains Mono`.
- The single most important metric may use the gold-gradient hero treatment + a progress bar (e.g. occupancy).

### Tables
- `onyx` card wrapper; header row `onyx-2` bg with uppercase `ash` labels.
- Rows: `1px iron` bottom border, hover → `onyx-2`, cursor pointer (rows are clickable → detail).
- Status shown as a **colored dot + label** (`win`/`warn`/`loss`/`ash`), not a full-bg pill.
- Reveal a gold `→` on row hover to signal drill-in.

### Status dots
`7px` circle + 6px gap + label. Active=`win`, At risk=`warn`, Overdue=`loss`, Frozen=`ash`. Live/pulsing states add the pulse animation (see §6).

### Alerts / "needs attention"
- `gold-dim` bg, `gold-line` border, radius 10px.
- Icon + bold title + `ash` subtext + gold `→` affordance.
- Reserved for genuinely actionable items (failed payments, churn risk, unsigned waivers).

### Badges (plans)
Small (11–12px/700), radius 5–6px, colored per §2 plan table.

### Bottom nav (PWA only)
- Fixed, blurred `rgba(14,14,14,.92)` bg, `1px iron` top border.
- 5 slots; center slot is a **raised gold action button** (the QR check-in) lifted `-24px` with a gold glow shadow.
- Active tab = `gold`; inactive = `ash-dim`.

### Phone frame (PWA mockups only)
390×844, radius 44px, `1px iron` border. Not used in production — presentation only.

---

## 6. Motion

Keep it minimal and purposeful. Approved animations only:
- **Live pulse** on "live/active" dots (`win`): 2s infinite expanding ring.
- **Scanner line** sweep on the QR scanner window (2.4s ease-in-out).
- **Hover transitions:** `0.12–0.15s` on color/background/border.
- **Fresh-row highlight:** newest check-in briefly tinted `gold-dim`.

Avoid: parallax, page-load stagger cascades, decorative float/bounce. Extra motion reads as unfinished.

```css
@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(63,185,80,.5); }
  70%  { box-shadow: 0 0 0 7px rgba(63,185,80,0); }
  100% { box-shadow: 0 0 0 0 rgba(63,185,80,0); }
}
```

---

## 7. Voice & microcopy

- **Arena vocabulary, sparingly:** "In the arena now" (occupancy), "Arena Pass" (member QR), "Arena scanner" (front desk), "Gladiator Games" (challenges), plan tiers "Rookie / Warrior / Gladiator".
- Warm and direct. "Ready to train, Rina 👋", not "Welcome back, user."
- Labels are nouns ("Check-ins today"), actions are verbs ("Add member", "Check in").
- Numbers are specific and real-looking, never `0`/`Lorem`. Empty states get their own friendly copy, not a bare `0`.
- Emoji allowed as functional iconography in the member PWA; keep the admin app emoji-light (icons/SVG preferred in production).

---

## 8. Accessibility

- Body/label text must hold **≥4.5:1** contrast on its background; `ash-dim` is for non-essential text only.
- Gold buttons use black text (passes contrast); never gold text on light.
- Don't encode status by color alone — always pair the dot/color with a text label.
- Interactive targets ≥ 40×40px, especially in the PWA.
- Respect `prefers-reduced-motion`: disable pulse/scanner sweeps.
- Focus states: 2px `gold` outline/ring on keyboard focus.

---

## 9. Do / Don't

**Do**
- Lead screens with live data and one clear hero.
- Group secondary navigation into a labeled directory, not a flat wall.
- Use `JetBrains Mono` for all figures.
- Flag actionable problems (overdue, at-risk) in context, at the moment they matter.

**Don't**
- Put the brightest element (gold) on the least useful number.
- Give every module identical visual weight.
- Use pure white text or pure black card surfaces.
- Add more than one gold CTA per action group.
- Introduce new accent hues outside the token set.
