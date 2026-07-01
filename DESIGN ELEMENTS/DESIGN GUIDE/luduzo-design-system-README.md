# Luduzo Design System

Everything Claude Code and VS Code need to build Luduzo UI consistently.

## Contents

| File | Purpose |
|------|---------|
| `DESIGN_GUIDELINES.md` | **The spec.** Full design system — principles, tokens, type, components, voice, a11y. Read this first. |
| `CLAUDE.md` | Rules for Claude Code. Append to your repo's root `CLAUDE.md`. |
| `tokens.css` | CSS variables + base reset. Import once at app root. |
| `tailwind.config.js` | Palette/type/motion wired into Tailwind utilities. |
| `components-ui.jsx` | Canonical React components (Button, Card, StatBlock, StatusPill, PlanBadge, AlertItem, DataTable…). |
| `.vscode/settings.json` | Editor hints so tokens autocomplete and colors preview inline. |

## Setup (Next.js / React + Tailwind)

1. **Fonts** — add to your root layout `<head>`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
   ```

2. **Tailwind** — merge `theme.extend` from `tailwind.config.js` into your config. Set `darkMode: 'class'` and add `class="dark"` to `<html>`.

3. **Tokens** — `import './design-system/tokens.css'` in your root (for CSS-var access alongside Tailwind).

4. **Components** — move `components-ui.jsx` into `components/ui/` (split into files if you prefer). Import:
   ```jsx
   import { Button, Card, StatBlock, StatusPill, PlanBadge } from '@/components/ui';
   ```

5. **Claude Code** — append `CLAUDE.md` to your repo root `CLAUDE.md`. Claude Code will then follow the system automatically on every task.

## Quick usage

```jsx
<StatBlock hero label="In the arena now" value="38" unit="/ 60 capacity">
  <ProgressBar pct={63} className="mt-3.5" />
</StatBlock>

<Button variant="gold">＋ Add member</Button>

<StatusPill status="overdue" />
<PlanBadge plan="warrior" />

<AlertItem icon="💳" title="4 failed payments" subtext="₱7,800 at risk · retry now" />
```

## Core rules (see CLAUDE.md / guidelines for full list)

- Tokens only — never inline hex.
- Dark-first; `bone` text, not white.
- Gold only for action/attention; one gold CTA per group; black text on gold.
- Lead with data + one hero per screen.
- `font-mono` for all numbers.
- Status = dot + label, never color alone.
- Minimal motion; honor `prefers-reduced-motion`.

## Palette reference

```
black #0A0A0A   onyx #161616 / #1C1C1C   iron #2A2A2A / #333
bone  #EDEDED   ash  #8A8A8A / #5E5E5E
gold  #F5C518   (dim .14 / line .35)
win   #3FB950   loss #E5534B   warn #E3A008
Warrior #F5C518 · Gladiator #B794F4 · Rookie #8A8A8A
```

Fonts: **Montserrat** (display/UI) · **JetBrains Mono** (numbers).
