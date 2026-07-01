# Luduzo — Brand Asset Package

Complete visual identity for the Luduzo gym management SaaS, built from the master logo.

## Folder structure

```
luduzo_brand/
├── logo/
│   ├── svg/        Vector logos (scalable, use these for web + print)
│   └── png/        Raster exports at multiple sizes (transparent bg)
├── favicon/        Website favicon set + web manifest
├── social/         Avatars, OG share image, profile banner
├── brand/          Design tokens (CSS) + brand guidelines PDF
└── mockups/        Ready-to-open HTML pages (landing, dashboard, pricing)
```

## Logo files (logo/svg)

| File | Use |
|------|-----|
| `luduzo_helmet.svg` | Icon only, black helmet + gold plume |
| `luduzo_helmet_white.svg` | Icon for dark backgrounds |
| `luduzo_helmet_mono_black/white.svg` | Single-color versions |
| `luduzo_horizontal.svg` | Icon + wordmark, light bg |
| `luduzo_horizontal_dark.svg` | Icon + wordmark, dark bg |
| `luduzo_stacked.svg` / `_dark.svg` | Vertical lockup |
| `luduzo_app_icon.svg` | Rounded-square app icon |

PNG versions of each sit in `logo/png/` at 128–2048px. SVG is preferred wherever possible — it stays crisp at any size.

## Colors

| Name | Hex | Use |
|------|-----|-----|
| Gladiator Black | `#0A0A0A` | Backgrounds, text |
| Plume Gold | `#FECE00` | Primary accent, CTAs |
| Arena White | `#FFFFFF` | Light surfaces, text on dark |
| Onyx / Iron / Ash / Fog | `#1C1C1C` `#3A3A3A` `#8A8A8A` `#F4F4F2` | Neutrals |
| Win / Loss | `#16A34A` `#DC2626` | Status |

Full variables in `brand/luduzo-tokens.css`.

## Typography

- Display + headings: Montserrat (700 / 800)
- Body + UI: Inter (400 / 500 / 600)

Both are free on Google Fonts:
`https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600&display=swap`

## Favicon setup

Drop the `favicon/` contents at your site root and add to `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

## Mockups

Open the `.html` files in `mockups/` directly in a browser. They use the inline
vector logo and load fonts from Google Fonts, so no build step is needed.

## Note on the logo vector

The SVG helmet was traced from the supplied logo image. It is faithful and
production-ready for web/app use. For large-format print or if you want the
paths hand-refined to Bezier precision, hand this SVG to a designer as the
starting point.

---
Generated 2026 · v1.0
