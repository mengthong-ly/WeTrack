# Line-art Monochrome Design System (portable spec)

> Extracted from WeTrack. Drop this file in any project (as `DESIGN.md`, or `@`-import it from `CLAUDE.md`) and an
> agent can build screens that look exactly like this one. Stack assumed: **Tailwind v4 + shadcn/ui (Base UI) +
> Motion (`motion/react`)**. Every value below is the real shipped value, not a suggestion.

---

## 0. Instructions for the agent (read first)

1. **Calm and monochrome.** Black, white and soft greys carry the UI. Colour exists only to carry *meaning*
   (status, priority, health, project identity). Never decoration.
2. **No decorative gradients, no coloured shadows, no glow, no emoji.** The only "gradients" are the three listed in §8.
3. **Use tokens, never literals.** No raw hex, no `rounded-[…]`, no `text-red-500` in app code. If a value is missing,
   add a token (§13), then use it.
4. **Hierarchy comes from size and weight-lightness, not boldness.** Big numbers/titles are `font-light`. Nothing is `font-bold`.
5. **Surfaces separate by a 1px hairline ring + tone, not by drop shadow.**
6. **Every list needs: loading skeleton, filtered-empty, true-empty, and an error line.** (§10–§12)
7. **Build for 375px first**, no horizontal page scroll, touch targets ≥ 40px. Dark mode is a first-class theme.
8. **Sentence case, short, human copy.** No exclamation marks. Say what happened or what to do next. (§15)
9. Before shipping, run the checklist in §16.

---

## 1. Design philosophy

| # | Principle | In practice |
|---|---|---|
| 1 | Calm and monochrome | Ink `#262626` on white; `#f5f5f5` on near-black. Meaning colour is rare, so it is noticed. |
| 2 | Crisp and quiet | One radius (14px) for every surface, 8px for list rows, pills for controls. 1px alpha hairlines. |
| 3 | Big light numbers, small quiet labels | KPI = `text-5xl sm:text-6xl font-light`. Label = `text-sm text-muted-foreground`. |
| 4 | Generous space, few things per screen | One clear section beats three dense ones. Sections `gap-6`–`gap-8`. |
| 5 | Motion explains change | Things rise in, reorder, count up. Never decorate, never block an action. |
| 6 | Edit in place | Selects save on change, text on blur. No separate "edit" screens for single values. |

Look in one sentence: **a technical-drawing / isometric line-art feel: near-black canvas with a faint dot grid, `#151515`
tiles outlined by 8–15% alpha hairlines, pill controls, light-weight Poppins headings.**

---

## 2. Setup (copy into a new project)

### 2.1 Fonts (`app/layout.tsx`)

```tsx
import { Geist_Mono, Google_Sans, Poppins } from "next/font/google"
const googleSans = Google_Sans({ subsets: ["latin"], variable: "--font-google-sans" })          // UI text, 400–700
const poppins    = Poppins({ subsets: ["latin"], weight: ["300","400","500","600"], variable: "--font-poppins" }) // headings, big numbers
const mono       = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })            // codes, kbd, engraved labels
// <html className={`${googleSans.variable} ${poppins.variable} ${mono.variable}`}> and default theme = dark
```

Google Sans has **no light weight**; that is why headings/big numbers use Poppins (300). Fallback: point `--font-sans`
at `--font-poppins` to run on Poppins alone.

### 2.2 `globals.css` (complete token block, light + dark)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-heading: var(--font-poppins), var(--font-sans);
  --font-sans: var(--font-google-sans), ui-sans-serif, system-ui, sans-serif;

  /* map every CSS var to a Tailwind colour utility */
  --color-background: var(--background);   --color-foreground: var(--foreground);
  --color-card: var(--card);               --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);         --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);         --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);     --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);             --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);           --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive); --color-destructive-foreground: var(--destructive-foreground);
  --color-info: var(--info);               --color-info-foreground: var(--info-foreground);
  --color-success: var(--success);         --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);         --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);           --color-input: var(--input);          --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);         --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);  --color-sidebar-border: var(--sidebar-border);

  /* radius: base 14px, rows 8px */
  --radius-sm: calc(var(--radius) * 0.6);  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);              --radius-xl: calc(var(--radius) * 1.4);
  --radius-row: 0.5rem;
  --radius-panel: 0.875rem; --radius-card: 0.875rem; --radius-tile: 0.875rem; --radius-sheet: 0.875rem;

  /* elevation = hairline ring + faint drop (redefines shadow-sm / shadow-md app-wide) */
  --shadow-sm: 0 0 0 1px var(--border), 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --shadow-md: 0 0 0 1px var(--border), 0 4px 12px -2px rgb(0 0 0 / 0.08);

  --ease-snap: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

:root {                                   /* LIGHT */
  --background: #ffffff;   --foreground: #262626;
  --card: #ffffff;         --card-foreground: #262626;
  --popover: #ffffff;      --popover-foreground: #262626;
  --primary: #262626;      --primary-foreground: #fafafa;
  --secondary: #0000000a;  --secondary-foreground: #262626;
  --muted: #0000000a;      --muted-foreground: #686868;
  --accent: #0000000a;     --accent-foreground: #262626;
  --destructive: oklch(0.637 0.237 25.331);        --destructive-foreground: oklch(0.505 0.213 27.518);
  --info:        oklch(0.623 0.214 259.815);       --info-foreground:        oklch(0.488 0.243 264.376);
  --success:     oklch(0.696 0.17 162.48);         --success-foreground:     oklch(0.508 0.118 165.612);
  --warning:     oklch(0.769 0.188 70.08);         --warning-foreground:     oklch(0.555 0.163 48.998);
  --border: #00000014;     --input: #0000001a;     --ring: #a1a1a1;
  --radius: 0.875rem;
  --sidebar: #fafafa;      --sidebar-foreground: #262626;
  --sidebar-accent: #0000000a;  --sidebar-border: #0000000f;
}

.dark {                                   /* DARK */
  --background: #0e0e0e;   --foreground: #f5f5f5;
  --card: #151515;         --card-foreground: #f5f5f5;
  --popover: #151515;      --popover-foreground: #f5f5f5;
  --primary: #f5f5f5;      --primary-foreground: #262626;
  --secondary: #ffffff07;  --secondary-foreground: #f5f5f5;
  --muted: #ffffff08;      --muted-foreground: #818181;
  --accent: #ffffff08;     --accent-foreground: #f5f5f5;
  --destructive: #fb414a;  --destructive-foreground: oklch(0.704 0.191 22.216);
  --info-foreground: oklch(0.707 0.165 254.624);
  --success-foreground: oklch(0.765 0.177 163.223);
  --warning-foreground: oklch(0.828 0.189 84.429);
  --border: #ffffff14;     --input: #ffffff1c;     --ring: #8a8a8a;
  --sidebar: #090909;      --sidebar-foreground: #f5f5f5;
  --sidebar-accent: #ffffff08;  --sidebar-border: #ffffff10;
}

/* dark only: faint dot grid under the main panel, like a technical drawing */
.dark [data-slot="sidebar-inset"] {
  background-image: radial-gradient(color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply min-h-svh bg-sidebar text-foreground; }
  :is(h1, h2) { @apply font-heading; }
  .tabular { font-variant-numeric: tabular-nums; }
  html { @apply font-sans; }
}

/* dotted field behind an empty state, faded toward its edges */
@utility bg-dots {
  position: relative; isolation: isolate;
  &::before {
    content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background-image: radial-gradient(color-mix(in oklab, var(--foreground) 16%, transparent) 1px, transparent 1px);
    background-size: 16px 16px; background-position: center;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
  }
}
```

---

## 3. Colour

### 3.1 Neutral palette (the whole UI)

| Token | Utility | Light | Dark | Use |
|---|---|---|---|---|
| `--background` | `bg-background` | `#ffffff` | `#0e0e0e` | The main inset panel (canvas). |
| `--sidebar` | `bg-sidebar` | `#fafafa` | `#090909` | Frame around the panel, the sidebar, `<body>`, auth pages. |
| `--card` | `bg-card` | `#ffffff` | `#151515` | Sheets, tiles, dialogs, popovers. In dark a step above the panel. |
| `--muted` / `--accent` / `--secondary` | `bg-muted` | `#0000000a` (4% ink) | `#ffffff08` (3% white) | Grey cards inside a sheet, hover fills, chip tracks. |
| `--foreground` / `--primary` | `text-foreground`, `bg-primary` | `#262626` | `#f5f5f5` | Text, primary buttons, active pill, filled checkbox. |
| `--muted-foreground` | `text-muted-foreground` | `#686868` | `#818181` | Secondary text, labels, meta, placeholders. |
| `--border` | `border`, `ring-border` | `#00000014` (8%) | `#ffffff14` (8%) | Hairlines, card rings. |
| `--input` | `border-input` | `#0000001a` (10%) | `#ffffff1c` (11%) | Control borders. |
| `--ring` | `ring-ring` | `#a1a1a1` | `#8a8a8a` | Focus ring (`ring-3 ring-ring/50`). |

Foreground opacity ladder used for lines/fills: `foreground/5` (ring on glass), `/10` (dividers, progress track),
`/15` (blockquote bar), `/30` (idle checkbox border), `/60` (checkbox hover), `/70–80` (secondary label).

### 3.2 Feedback colours (alerts, badges, icon tiles)

| Token | Hue | Fill | Edge | Text/icon |
|---|---|---|---|---|
| `info` | blue | `bg-info/10` | `border-info/25` | `text-info-foreground` |
| `success` | emerald | `bg-success/10` | `border-success/25` | `text-success-foreground` |
| `warning` | amber | `bg-warning/10` | `border-warning/25` | `text-warning-foreground` |
| `destructive` | red | `bg-destructive/10` | `border-destructive/25` | `text-destructive-foreground` (errors: `text-destructive`) |

Recipe is always **10% fill + 25% edge + `-foreground` text**. Never a solid saturated block.

### 3.3 Semantic meaning colours (single source of truth, `lib/labels.ts`)

Read these from one file; never re-pick a colour in a component. Pattern: `text-<hue>-600 dark:text-<hue>-400`.

| Meaning | Colour | Class |
|---|---|---|
| Urgent / Overdue / Blocked / Behind | red | `text-red-600 dark:text-red-400` |
| Due soon / At risk | amber | `text-amber-600 dark:text-amber-400` |
| In progress | orange | `text-orange-600 dark:text-orange-400` |
| Review / Test | violet | `text-violet-600 dark:text-violet-400` |
| Completed / On track | emerald | `text-emerald-600 dark:text-emerald-400` |
| Normal priority | blue | `text-blue-600 dark:text-blue-400` |
| Not started / No rush / No deadline / Done | muted | `text-muted-foreground` |

Solid health dots (`size-1.5 rounded-full`): `bg-red-500`, `bg-amber-500`, `bg-emerald-500`, `bg-muted-foreground`.

**Identity colours** (project dots only, 9 swatches): `#737373 #ef4444 #f97316 #eab308 #22c55e #06b6d4 #3b82f6 #8b5cf6 #ec4899`.
Shown only as a `size-2` `rounded-full` dot (`size-2.5` when it stands alone). They never colour a surface or line.

> Rule: if semantic colour sits on `bg-muted` at `text-xs`, use the `-600/-400` shades above, never lighter, to keep AA contrast.

---

## 4. Typography

**Fonts:** UI = Google Sans (400/500/700 only). Headings (`h1`, `h2`, `.font-heading`) and big numbers = Poppins (300–600). Code/kbd = mono.

| Role | Classes | Size / leading* |
|---|---|---|
| Task / document title | `text-4xl sm:text-5xl font-light tracking-tight` | 36/40 → 48/48 |
| Big number (KPI, %) | `text-5xl sm:text-6xl font-light tracking-tight` + `.tabular` | 48/48 → 60/60 |
| Page title | `text-3xl sm:text-4xl font-light tracking-tight` | 30/36 → 36/40 |
| Auth / drawer heading | `text-2xl font-light` | 24/32 |
| Card title | `text-lg sm:text-xl leading-snug` (regular) | 18 → 20 |
| Section heading | `text-lg` (regular) | 18/28 |
| Body | `text-base` or `text-sm` | 16/24 · 14/20 |
| Label, meta, hint | `text-sm` or `text-xs` + `text-muted-foreground` | 14 · 12/16 |
| Kbd hint | `text-[11px]` | 11 |
| Engraved/mono label | `font-mono text-[0.85em]` | relative |

\*Tailwind defaults.

**Weights:** `font-light` (300) titles + numbers · regular (400) body/headings below page level · `font-medium` (500)
only for chips, logo, tiny emphasis, form labels. **Never `font-bold`/`semibold`.** Hierarchy is made with *size*.
**Tracking:** `tracking-tight` on every `font-light` display size; nothing else is tracked.
**Numbers that change:** always `.tabular`. **Case:** sentence case; no ALL CAPS labels.

**Rich text (markdown body):** `.rich` = `flex flex-col gap-2 leading-relaxed`. `h1 text-3xl font-light` · `h2 text-2xl font-light` ·
`h3 text-lg` · `strong font-medium` · links underlined `decoration-foreground/30` → `/100` on hover · blockquote
`border-l-2 border-foreground/15 pl-3 text-muted-foreground` · inline code `rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em]` ·
code block `rounded-row bg-muted px-4 py-3 font-mono text-sm` · hr `h-px bg-foreground/10` · image `max-h-72 rounded-panel ring-1 ring-foreground/5`.

---

## 5. Spacing, layout, sizing

### 5.1 Scale (Tailwind 4px base; only these appear)

`0.5 (2) · 1 (4) · 1.5 (6) · 2 (8) · 2.5 (10) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) · 14 (56)`

| Use | Value |
|---|---|
| Icon ↔ label gap | `gap-1.5` (6) |
| Chip internal | `px-2.5 py-1` |
| Cards stacked in a list | `gap-2.5` (10) |
| Grid gutter (card grid) | `gap-4` (16) |
| Section ↔ section | `gap-6` to `gap-8` (24–32) |
| Label → big number | `mt-6` (24) inside a tile |
| Logo → auth heading | `mb-10` (40) |
| Auth heading → form | `gap-8` (32) |

### 5.2 Padding by surface

| Surface | Padding |
|---|---|
| Page shell (under header) | `px-4 py-6 sm:px-8 sm:py-8` |
| Sheet holding cards | `p-3 sm:p-4` |
| Sheet holding text | `p-6` |
| Stat tile | `p-5 sm:p-6` |
| Task card | `p-4 sm:p-5` |
| Card grid item | `p-5` (`h-80`) |
| Form card | `p-5 sm:p-6` |
| Document article | `px-5 py-6 sm:px-10 sm:py-9` |
| Popover / menu | `p-1.5` to `p-2` (items add their own) |
| Properties panel group | `p-1` / `p-1.5` |
| Empty state box | `px-5 py-6` |
| Drawer body | `px-6 pb-6` |
| Side panel | `p-2` |

### 5.3 Fixed sizes

| Element | Size |
|---|---|
| App header | `h-14` (56), sticky, `border-b bg-background/85 backdrop-blur` |
| Sidebar width / icon rail | default / `3rem` |
| Inset panel | `m-2 rounded-xl` hairline |
| Primary control (input, pill button) | `h-11` (44) (`h-12` for OTP/auth slots) |
| Default button | `h-8` (32); `lg` `h-9`; `sm` `h-7`; `xs` `h-6` |
| Round icon button (page) | `size-11` |
| Header icon button | `size-8 rounded-lg` |
| List row | `h-10`–`h-12`; property row `min-h-11` |
| Menu item | `h-10` (Spotlight-style: `min-h-11`, `text-base`) |
| Avatar | `size-7` + `ring-2 ring-card`; stacked avatars overlap |
| Icon in text | `size-4` (`size-3.5` small, `size-5` in tile) |
| Icon tile | `size-10 rounded-lg border` (page head), `size-11 rounded-full` (stat tile) |
| Checkbox | `size-5` / `size-6` circle, `border-[1.5px]` |
| Progress bar | `h-1.5 rounded-full` |
| Dot | `size-2` (`size-2.5` alone) |
| Drawer / side panel | drawer `32rem`; side panel `w-72`; contents column `w-56`; form `max-w-3xl`; auth `max-w-sm`; card grid `minmax(16rem,1fr)` |

### 5.4 Layout rules

- **Shell:** `bg-sidebar` frame → inset `bg-background` panel (`m-2 rounded-xl`) → sticky `h-14` header → page.
- **Grids:** stat tiles `grid-cols-2 lg:grid-cols-4`; main + side `lg:grid-cols-3` with main `lg:col-span-2`.
- **Responsive:** design for **375px**. Tables scroll *inside* their frame (`min-w-3xl table-fixed`), never the page. Pill rows that may overflow: `max-w-full`.
- Panels that hold content wrappers use `min-w-0` so wide rows can't stretch the page.
- Touch targets ≥ 40px.

---

### 5.5 Component box model (exact padding, margin, radius, height)

Two layers, and the difference matters:
- **Primitive** = the shared component's default (what you get with no className).
- **Page-level** = what screens override it to (`className`). Page actions, search, forms and nav are *pills*; primitives are not.

Margins are almost never set on components. **Spacing between things is `gap-*` on the parent flex/grid.** Margin is only used
for: `mt-6` (label under icon in a tile), `mb-10` (logo → heading), `mt-1` (a group under a label), `ml-auto` (push an action right),
`-mx-1.5` (optical alignment of a sort button), `-mx-1 my-1` (menu separator).

#### Buttons

| | Primitive (coss `Button`, mobile / `sm+`) | Page-level pill |
|---|---|---|
| Radius | `rounded-lg` (14px); `xs` `rounded-md` | `rounded-full` |
| Height | default `h-9` / `h-8` · `lg` `h-10`/`h-9` · `sm` `h-8`/`h-7` · `xs` `h-7`/`h-6` · `xl` `h-11`/`h-10` | `h-10` (standard) · `h-11` (focus-page submit, auth, round icon) |
| Padding X | default `px-3`(−1px border) · `lg` `px-3.5` · `sm` `px-2.5` · `xs` `px-2` · `xl` `px-4` | `px-4` (compact) · `px-5` (standard) · icon-only = `size-*` |
| Icon-only | `icon` `size-9`/`size-8` · `icon-sm` `size-8`/`size-7` · `icon-lg` `size-10`/`size-9` · `icon-xl` `size-11`/`size-10` · `icon-xs` `size-7`/`size-6` | `size-11 rounded-full` (page) · `size-8 rounded-lg` (header) |
| Gap icon ↔ label | `gap-2` (`gap-1.5` in `sm`, `gap-1` in `xs`) | `gap-2` |
| Font | `text-base font-medium` (`text-sm` on `xs`, mobile `xl` `text-lg`) | `text-sm font-medium` |
| Icon size | `size-4.5`→`size-4` by size, `size-3.5` in `sm`/`xs` | `size-4` |
| Border | 1px (`border-primary` default; `border-input` outline; transparent ghost) | same |
| Press | `active:` darken | `active:scale-95` |

shadcn `ui/button` (used in older spots): `rounded-lg`, `h-8 gap-1.5 px-2.5 text-sm`; `sm h-7 px-2.5`; `lg h-9`; `icon size-8`.

#### Inputs, selects, textarea

| | Primitive | Page-level |
|---|---|---|
| Input (coss) | `rounded-lg`, `h-9.5` (`lg`) / `h-8.5` default → `sm:h-7.5`, `px-3` (−1px), `text-base` | form: `size="lg"`; auth: `h-11 rounded-full bg-card shadow-sm`, label `pl-4` |
| Input (shadcn) | `h-8 rounded-lg px-2.5 py-1 text-base` | |
| Textarea | `rounded-lg min-h-16 px-2.5 py-2` | message box `rounded-panel` |
| Select trigger | `rounded-lg py-2 pr-2 pl-2.5 gap-1.5` | filter pick `h-9 sm:h-8 min-w-36 rounded-lg`; inline edit `Pick variant="ghost"` `h-9 rounded-full` |
| Select/menu popup | `rounded-lg p-1`, item `rounded-md px-1.5 py-1 gap-1.5 text-sm`; group label `px-1.5 py-1 text-xs` | Spotlight menu: `rounded-sheet`, items `min-h-11 rounded-row`, `text-base` |
| Border / fill | 1px `border-input`, `bg-transparent` (outline edge light) | `bg-card shadow-sm` on canvas |
| OTP slot | | `size-12 rounded-row bg-card text-lg`, first/last `rounded-l-row`/`rounded-r-row` |
| Label ↔ field | `gap-2`; hint below `text-xs text-muted-foreground` | field stack `gap-5`, form `gap-8` (auth) |

#### Cards, sheets, tiles (box recipes)

| Surface | Radius | Padding | Fill / edge | Notes |
|---|---|---|---|---|
| Sheet holding cards | `rounded-sheet` | `p-3 sm:p-4` | `bg-card shadow-sm` | cards inside stack `gap-2.5` |
| Sheet holding text | `rounded-sheet` | `p-6` (`p-4 sm:p-6` responsive) | `bg-card shadow-sm` | |
| Tile / stat tile | `rounded-tile` | `p-5 sm:p-6` | `bg-card/60 ring-1 ring-foreground/[0.03] backdrop-blur` | label `mt-6` below icon |
| Task card | `rounded-card` | `p-4 sm:p-5` | `bg-muted/60–80` | |
| Document `article` | `rounded-tile` | `px-5 py-6 sm:px-10 sm:py-9` | `bg-card shadow-sm` | |
| Card-grid item | `rounded-tile` | `p-5`, `h-80` | `bg-card shadow-sm` | |
| Inner panel / group | `rounded-panel` | `p-1.5` (group of rows `p-1`) | `bg-muted/60` | rows inside `h-12 rounded-row` |
| Form card | `rounded-sheet` | `p-5 sm:p-6` | `bg-card border`, `max-w-3xl` | |
| Empty box (inline) | `rounded-card` | `px-5 py-6` (`py-8` centred) | `bg-muted/60` | |
| coss `Card` (when used) | `rounded-2xl` (~24px) | header `p-6`, panel `p-6`, footer `p-6` | `border bg-card shadow-xs/5` + inner 1px light | header↔title `gap-1.5` |
| Dialog | `rounded-tile` (shadcn default `rounded-xl`) | `p-4`, `gap-4`; footer `-mx-4 -mb-4 p-4 bg-muted/50 border-t` | `bg-popover ring-1 ring-foreground/10` | `sm:max-w-sm` default |
| Popover | `rounded-tile` (shadcn `rounded-lg`) | `p-2.5` (`p-1.5`/`p-2` custom), `gap-2.5`, `w-72` | `bg-popover shadow-md ring-1` | |
| Side sheet | `sm:rounded-l-tile` | header `p-4`, footer `p-4`, `gap-4` | `bg-popover shadow-lg` | `sm:max-w-md` |
| Tooltip | `rounded-md` (page: `rounded-full`) | `px-3 py-1.5` | `bg-foreground text-background text-xs` | arrow `size-2.5` |

#### Data table (every list of records)

```
CardFrame (coss, rounded-2xl, hairline)                                  
├─ header band      px-5 py-3, flex row, title font-medium + .tabular count (muted), action ml-auto
├─ card             rounded-xl border bg-card overflow-hidden  (opacity-60 while pending)
│  └─ Table         min-w-3xl table-fixed text-sm      (scrolls inside; page never scrolls)
│     ├─ TableHead  h-10 px-2.5, text-left, font-medium text-muted-foreground, leading-none
│     │             first column ps-5 · last column pe-5
│     ├─ TableRow   border-b (last row none) · hover = 2% black/white tint of the background
│     └─ TableCell  p-2.5, align-middle, leading-none, whitespace-nowrap
│                   main title cell: h-14 ps-5 (task) / h-12 · controls cell: relative z-10 px-1
│                   numeric cells: .tabular text-right (or muted) · last cell: pe-3 text-right
└─ footer band      px-5 py-3 → DataPagination: "Showing 26–50 of 132" (.tabular text-sm muted) left,
                    buttons right, gap-3, wraps
```

- Row height is ~`h-12`–`h-14` (set on the main cell), header `h-10`. Avatar column `w-14 pe-3`; checkbox column `w-px`.
- Sort button: `-mx-1.5 h-7 px-1.5 rounded-md gap-1 font-medium`, hover `bg-muted`; arrow `size-3.5`.
- Above the table: `PageHead` (`gap-x-6 gap-y-4`, title/description `gap-2`, icon tile `size-10 rounded-lg border`, h1 `gap-3`)
  → `Toolbar` (`gap-2`, wraps) → `DataFrame`. Between head, toolbar and frame use `gap-4`–`gap-6` on the page column.
- Search field `flex-1 basis-40 sm:max-w-72`; filter pick `h-9 sm:h-8 min-w-36`.
- Empty state inside the frame: `px-6 py-12 md:py-20`, `gap-6`, content `max-w-sm gap-4`, icon block `mb-6`.

#### Tabs, chips, small pieces

| Piece | Radius | Size / padding |
|---|---|---|
| Segmented tabs track | `rounded-lg` | `p-0.5` (shadcn `p-[3px]`), tabs `gap-x-0.5`, height `h-8`, tab `rounded-md px-1.5 py-0.5 gap-1.5 text-sm font-medium` |
| Priority / role chip | `rounded-full` | `px-2.5 py-1 text-xs font-medium gap-1.5` |
| Kbd | `rounded-md` | `h-5 min-w-5 text-[11px]` |
| Inline code | `rounded-md` | `px-1.5 py-0.5` |
| Menu item (shadcn) | `rounded-md` | `px-1.5 py-1 gap-1.5 text-sm`; page menus `h-10 rounded-row px-3` |
| List row (muted) | `rounded-row` | `px-3 py-2.5` to `px-4 py-3`, `gap-3`, min height `h-10`–`min-h-14` |
| Sidebar row | `rounded-lg` | `h-8`–`h-9`, `gap-2` |

---

## 6. Radius

One 14px radius for every surface; rows 8; controls are pills.

| Utility | px | Use |
|---|---|---|
| `rounded-full` | pill | **Page-level** buttons/inputs/selects (`h-10`/`h-11`), chips, nav rows, avatars, round icon buttons, checkboxes, dots, progress. (Primitives default to `rounded-lg`; see §5.5) |
| `rounded-lg` / `rounded-sheet` / `rounded-tile` / `rounded-card` / `rounded-panel` | 14 | Sidebar rows, header buttons, sheets, cards, tiles, dialogs, popovers, inner panels, empty-state box |
| `rounded-row` | 8 | List rows, sub-tasks, comment bubbles, checklist items, calendar cells, menu items, code blocks |
| `rounded-md` | ~11 | Kbd chips, inline code |
| `rounded-xl` | ~20 | Only the inset panel |

Sheet-edge exceptions: side sheet `sm:rounded-l-tile`, bottom sheet `rounded-t-tile`.

---

## 7. Elevation, borders, glass

| Level | Recipe |
|---|---|
| Flat | no shadow (canvas content) |
| **Surface** | `shadow-sm` = `0 0 0 1px var(--border), 0 1px 2px rgb(0 0 0/.04)`: a hairline ring, so white cards read on a white panel |
| **Hover (clickable card)** | `shadow-md` = ring + `0 4px 12px -2px rgb(0 0 0/.08)` |
| **Floating chrome** | `shadow-lg` (menus, block menu, bottom bar). `shadow-xl` rare. |
| **Glass** | `bg-card/70 ring-1 ring-foreground/5 backdrop-blur` (round buttons, crumbs); menus `bg-popover/85 backdrop-blur-xl`; format bar `bg-card/80 backdrop-blur shadow-lg` |
| Tone separation | grey card on white sheet: `bg-muted/60` or `/80` (the "inversion") |

Borders: always 1px, always alpha (`border-border`, `border-input`). Outline controls add the coss **edge light**: inner 1px
line (light `0 1px black/4%` at the foot; dark `0 -1px white/6%` at the top) on `bg-background` (dark `bg-input/32`).

---

## 8. Gradients and backgrounds (the complete list)

The system is flat. Only these exist:

1. **Dark dot grid** under the main panel: `radial-gradient(foreground 6%, transparent 1px)`, `22px` tile.
2. **Empty-state dot field** (`bg-dots`): `radial-gradient(foreground 16%, transparent 1px)`, `16px` tile, masked by
   `radial-gradient(ellipse at center, black 40%, transparent 85%)` so dots fade toward the edges.
3. **Image skyline fade** (auth floor): photo, `grayscale`, masked at the top so it dissolves into the canvas.

Soft layering uses **alpha fills** (`bg-card/60`, `bg-muted/60`, `/70`, `/80`, `/85`) plus `backdrop-blur`, never colour gradients.
Do not add linear gradients, colour glows, mesh blobs or gradient text.

---

## 9. Element hierarchy

### 9.1 Surface stack (always in this order)

```
body / frame ........ bg-sidebar (#fafafa | #090909)
└─ inset panel ...... bg-background (#fff | #0e0e0e), m-2 rounded-xl, hairline, dot grid in dark
   ├─ header h-14 ... sticky, border-b, bg-background/85 backdrop-blur
   └─ page .......... px-4 py-6 sm:px-8 sm:py-8
      ├─ page head ... icon tile + font-light title + count + one muted line + primary action (right)
      ├─ stat tiles .. bg-card/60 rounded-tile on the canvas
      └─ sheet ....... bg-card rounded-sheet shadow-sm
         └─ cards .... bg-muted/60–80 rounded-card  (grey on white)
            └─ row ... rounded-row, hover bg-muted
```

Dark mode keeps the same stack; the step between levels is carried by `#0e0e0e → #151515` and the 8–15% outlines.

### 9.2 Reading order inside any block

1. **Icon / mark** (muted, small)  →  2. **Primary value or title** (largest, `font-light`)  →
3. **Label** (`text-sm`, `foreground/80` or muted)  →  4. **Meta** (`text-xs/sm` muted, right or below)  →  5. **Action** (pill, far right or footer).

Emphasis ladder: **size > colour contrast (foreground vs muted) > weight (medium only for chips)**. One dark filled pill (primary action) per view.

### 9.3 Action hierarchy

| Level | Look |
|---|---|
| Primary | `bg-primary text-primary-foreground` pill (`h-10`–`h-11`), one per view, names the result: "Create project", "Save changes" |
| Secondary | outline pill (`border-input`, edge light) or `bg-secondary` |
| Tertiary | `ghost`: hover `bg-muted` only |
| Link | muted text, underline on hover |
| Destructive | lives in a menu (`variant="destructive"`: `bg-destructive/10 text-destructive`), confirmed |

---

## 10. Components (exact recipes)

### 10.1 Buttons (shadcn `Button`, Base UI)

Base: `inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all
outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50
aria-invalid:border-destructive aria-invalid:ring-destructive/20`.

| Variant | Classes |
|---|---|
| default | `bg-primary text-primary-foreground hover:bg-primary/80` |
| outline | `border-border bg-background hover:bg-muted` · dark: `border-input bg-input/30 hover:bg-input/50` |
| secondary | `bg-secondary text-secondary-foreground hover:(secondary +5% foreground)` |
| ghost | `hover:bg-muted` · dark `hover:bg-muted/50` |
| destructive | `bg-destructive/10 text-destructive hover:bg-destructive/20` · dark `/20` `/30` |
| link | `text-primary underline-offset-4 hover:underline` |

Sizes: `xs h-6` · `sm h-7` · `default h-8` · `lg h-9` · `icon size-8` · `icon-sm size-7` · `icon-lg size-9`. Page-level pills are `rounded-full h-10/h-11`.
**Press:** pills/icon buttons `active:scale-95`, rows/cells `active:scale-97`, with `transition-[background-color,scale]`.
**Pending:** swap the label for `Spinner` + progressive text ("Signing in…"); only the pressed button changes. Submit buttons need `type="submit"` (Base UI default is `button`).

### 10.2 Inputs and forms

- Input: `h-11 rounded-full bg-card shadow-sm`, label above `pl-4 text-sm text-muted-foreground` (auth) or `text-sm font-medium` (form card). Textarea: `rounded-panel`.
- Hint under field: `text-xs text-muted-foreground`. Placeholder: muted.
- **Form card:** `rounded-sheet border bg-card p-5 sm:p-6 max-w-3xl` centred; fields stacked `gap-5`; two short fields share a row `sm:grid-cols-2`; actions at the foot, **left**: primary then ghost Cancel.
- Create and Edit are the same component, edit pre-filled. Dialogs only for tiny one-field asks.
- **OTP:** six `size-12 rounded-row bg-card` slots, submits on the sixth digit.

### 10.3 Chips, badges, tabs

- Priority chip: `inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium` + semantic text colour + `size-3.5` flag icon.
- Status: plain coloured text `text-sm`, no background.
- Health badge: `text-xs font-medium` + `size-1.5` dot.
- Role chip: `bg-muted` pill, capitalised.
- **Pill tabs:** segmented, active pill is `bg-foreground text-background`, animated with a shared `layoutId` (spring). Count inside a tab is `.tabular`.
- Kbd: `h-5 min-w-5 rounded-md bg-muted text-[11px]`, hidden below `sm`.

### 10.4 Stat tile

`rounded-tile bg-card/60 p-5 sm:p-6 ring-1 ring-foreground/[0.03] backdrop-blur`; top row: `size-11 rounded-full bg-card shadow-sm` icon (left) and
`text-sm text-muted-foreground` meta (right); then `mt-6` label `text-sm text-foreground/80`; then number `text-5xl sm:text-6xl font-light tracking-tight` counting up.

### 10.5 Rows and cards

- List row: `rounded-row bg-muted/60 hover:bg-muted`, `h-10`–`h-12`, press `active:scale-99`/`97`.
- Task card: `rounded-card p-4 sm:p-5`, title `text-lg sm:text-xl leading-snug`, round checkbox left, meta right. Clickable card = **stretched link** (`after:absolute after:inset-0`), inner controls `relative z-10`.
- Document card (grid): `h-80 rounded-tile bg-card p-5 shadow-sm`, body thumbnail fades out at the foot.
- Round checkbox: `size-5` circle `border-[1.5px] border-foreground/30`, hover `/60`, checked `bg-foreground` with a background-coloured tick (mask, so it flips in both themes).

### 10.6 Data table page (template for every list of records)

1. **Page head:** `size-10 rounded-lg border` tone-tinted icon tile + `font-light` title + `.tabular` count + one muted line + primary action right.
2. **Toolbar:** filter tabs left; search + pickers right (own row on phones). Search `/` focuses, `Esc` clears, URL-debounced 250ms.
3. **Frame:** header band (table name + match count) → white card with table (`min-w-3xl table-fixed`, first/last cell `ps-5`/`pe-5`) → pagination foot ("Showing 26–50 of 132", Prev, 7 fixed page slots, Next).
4. **Rows:** main cell is a stretched link; inline edits optimistic; destructive action in `⋯` menu.
5. **Sort:** `SortHead` button in `th`, faint ↕ on hover, ↑/↓ when active, cycle asc → desc → default.
6. **State in the URL** (`?q= ?sort= ?page=`), any change but page resets to page 1. No row animation when paging/sorting/filtering.

### 10.7 Overlays

Dialog/Sheet/Drawer/Popover/Menu/Tooltip all `bg-card` (menus `bg-popover/85 backdrop-blur-xl`), `rounded-tile` (14), `p-1.5`–`p-6`.
Side sheet `sm:max-w-md`; drawer width `32rem`; on phones a drawer becomes a bottom sheet with a swipe handle.
Tooltip: `rounded-full px-3 py-1.5`, for icon-only controls only. Toasts: `sonner`, top-centre.

### 10.8 Avatars, marks

`UserAvatar` `size-7 ring-2 ring-card`, fallback initials `text-[10px] font-medium`. Project mark: round `bg-card ring-1 ring-foreground/5 object-contain`, falls back to the colour dot.

---

## 11. States

Every interactive thing defines: **rest · hover · focus-visible · active/pressed · disabled · loading · error · selected**.

| State | Look |
|---|---|
| Hover | fill steps to `bg-muted` (or `hover:bg-card` inside a muted group); no colour change, no lift except clickable cards (`shadow-md`) |
| Focus-visible | `ring-3 ring-ring/50` + `border-ring`. Never remove an outline without a replacement |
| Pressed | `active:scale-95/97/99` (spring-fast), buttons also `translate-y-px` |
| Disabled | `opacity-50 pointer-events-none` |
| Selected | `bg-foreground text-background` (pills), `bg-card shadow-sm` (outline row), `data-[active=true]` in sidebar |
| Loading (action) | spinner replaces label, text says what is happening, button stays same width |
| Pending (list) | current rows stay, **dimmed**, until the next page lands |
| Invalid | `aria-invalid:border-destructive ring-3 ring-destructive/20` + message |

### 11.1 Loading skeletons

- One `loading.tsx` per area, built from shared skeleton parts that mirror the real layout: **TableSkeleton**, **PageSkeleton**
  (title + subtitle pills on `bg-card/70`, four `rounded-tile bg-card/60` tiles, a `rounded-sheet bg-card` sheet of `rounded-card bg-muted/60` rows),
  **FocusSkeleton** (document card + side panel in the page's own columns), **DetailSkeleton**.
- Skeleton bones are `bg-muted` (`bg-card/70` when sitting on the canvas) and **pulse**; pulsing stops under reduced motion.
- **Fade in after 150 ms** (ease-out-expo) so fast navigations never flash a skeleton.
- Skeleton shapes must match final geometry (same heights/columns) so nothing jumps. No random widths (breaks prerender).
- Header tool placeholders: `size-8 rounded-lg bg-muted`, no pulse.

### 11.2 Empty states

Two kinds, never confuse them:

**A. Inline (small list / panel):**
`rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground`. **One sentence that says what to do next.**
> "Nothing in progress. Pick something from Up next."

**B. Full (table / page), `DataEmpty` on `bg-dots`:**

```
        ┌──────────┐        stacked icon tile (muted, size-10, rounded-lg, border)
        │   icon   │
        └──────────┘
   No tasks yet              title:       text-lg font-normal, foreground
   Tasks you add show up     description: text-sm text-muted-foreground, 1 line, max ~2 sentences
   here.
   [ Add your first task ]   one action:  default or outline pill
```

- Centred, vertical rhythm ≈ `gap-2` between title/description, `gap-4` before the action. Padding generous (`py-12`+).
- **True empty** says what will appear and how to add the first one, with the primary action.
- **Filtered empty** says "No … match" and offers **Clear filters** (never the create action).
- **Notification/inbox empty:** the inline box, one friendly line.
- **No-WebGL / failed canvas:** poster fallback with a Reload button.
- No illustrations, no mascots, no coloured art. Dots + one icon only.

### 11.3 Error states

| Where | Look |
|---|---|
| Form field group | **One line** under the group: `text-sm text-destructive`, `role="alert"`. Plain words: what went wrong + how to fix. |
| Single invalid input | `aria-invalid` ring (`border-destructive ring-3 ring-destructive/20`; dark `/50` border `/40` ring) |
| Wrong OTP | clear the slots, **shake once** (skipped with reduced motion), keep focus (use `readOnly` while checking, never `disabled`), show the one-line error |
| Failed background save / inline edit | `toast.error("Couldn't save. Try again.")`; revert the optimistic value |
| Failed action with undo | success toast: past tense + **Undo** action ("Marked as fixed") |
| Destructive confirm | `confirm()` for irreversible; reversible ones (archive) use a toast with Undo instead |
| Page / route error | `error.tsx` renders the *inline-or-full empty state* shape: icon tile (destructive tone: `border-destructive/25 bg-destructive/10 text-destructive-foreground`), title "Something went wrong", one line, **Try again** button. Keep the shell (sidebar/header) |
| Not found | same shape, neutral tone, "We can't find that." + link back |
| Forbidden / expired link | same shape, one line on why + the action to fix |
| Offline / blocked | muted line in the row where the control would be ("Blocked in browser settings") |

Never: red full-width banners, exclamation marks, raw error codes, blaming the user, `alert()`.

### 11.4 Success / feedback

Success is **silent** for inline edits; toast only for create/delete/move, short past tense ("Task added"), optional action ("Open", "Undo").
Toasts: top-centre, one line.

---

## 12. Motion

| Token | Value | Use |
|---|---|---|
| `spring` | `{ type:"spring", stiffness:380, damping:32 }` | layout moves, pills, checkbox fill, list items, press |
| `ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances, progress, count-ups |
| Entrance (`Reveal`) | `0.5s`, `y:12 → 0`, `opacity 0 → 1`, delay `index × 0.06s` | page sections |
| List stagger | `0.035s` per item, max 8 | task cards |
| Count-up | `0.9s` ease-out-expo | big numbers |
| Progress fill | `0.8s` ease-out-expo, animate `width` | progress bar |
| Exit | ≤ `0.2s`, fade + scale `0.97` | removed items |
| Mode/step switch | `0.35s` ease-out-expo, slide 12px (sidebar) or 24px (steps); fade only if reduced motion | |
| Sidebar collapse | `400ms` `cubic-bezier(0.7,-0.15,0.25,1.15)` (small overshoot) | |
| Sidebar hover | one fill glides between rows, spring 350/35, fades `0.2s` after leave | |
| Skeleton | fades in after 150ms | |
| Route change | **none**: swap at once, sections `Reveal` | |

Rules: animate **only** `opacity`, `transform`, `width` (progress) and layout. Lists that change use
`AnimatePresence mode="popLayout"` + `layout`. **Always honour `prefers-reduced-motion`** (`useReducedMotion`; fade-only or none).
Never delay an action's result behind an animation. **No motion** on frequent actions: keyboard menus, table paging/sorting/filtering.
Never use React `<ViewTransition>` page transitions (each streamed commit freezes the screen).

---

## 13. Iconography

- One icon set (lucide); stroke 2, sized by context: `size-3.5` chip · `size-4` inline/default · `size-5` in a tile.
- Icons are **muted** (`text-muted-foreground`) until hovered or active. Nav icons may animate on row hover.
- Icon-only controls: `aria-label` + tooltip (with kbd hint where a shortcut exists).
- Brand marks of third parties keep their own colours: the single exception to "no raw colour".

---

## 14. Interaction patterns

- **Inline edit:** select → save on change; text → save on blur; date → save on change. Errors → `toast.error`. Success silent.
- **Optimistic** toggles (`useOptimistic`); server reconciles; revert on failure.
- **Create on a document page**, not a dialog (new task/feedback/project). Meetings and one-field asks may be dialogs.
- **Shortcuts:** `C` new, `⌘/Ctrl K` command menu, `/` focus search, `Esc` clear/close, `⌘B` sidebar. Single-key shortcuts ignore typing in fields.
- **Editor chrome appears only when needed:** `/` block menu at the caret, floating format bar on selection; neither animates.
- **URL is state** for filters/tabs/sort/page (History API, no navigation, no remount).
- **Destructive:** in a menu, destructive variant, confirmed.
- **Streaming pages:** static shell paints instantly; data in `<Suspense>` with a matching skeleton.

---

## 15. Voice and copy

- Sentence case everywhere. Short, plain, human. No exclamation marks, no jargon, no emoji.
- Buttons name the result: "Create project", "Save changes", "Send 3 points", not "Submit".
- Empty: what lives here + what to do. Error: what happened + how to fix. Success: past tense, 2–3 words.
- Pending text is progressive: "Sending code…", "Signing in…".
- Count nouns plainly: "4 rows", "Showing 26–50 of 132".

Examples: "Nothing in progress. Pick something from Up next." · "No tasks match. Clear filters." · "Check your email — we sent a code to a@b.com. It expires in 5 minutes." · "Couldn't save. Try again."

---

## 16. Accessibility

- Every icon-only button has `aria-label`; toggles use `aria-pressed` or `role="checkbox"` + `aria-checked`; progress uses `role="progressbar"` with `aria-valuenow/min/max`; sortable headers `aria-sort`; errors `role="alert"`.
- Keep focus rings (`ring-3 ring-ring/50`). Keyboard reaches everything, including scenes/canvases (provide an outline list).
- Touch targets ≥ 40px. WCAG AA contrast; semantic text uses the `-600` (light) / `-400` (dark) shades.
- Reduced motion respected everywhere. Public pages: `noindex`, `no-referrer`.

---

## 17. Before you ship UI (checklist)

- [ ] Reused an existing component/pattern; anything new is added to this doc.
- [ ] Only tokens: no raw hex, no `rounded-[…]`, no off-palette colour classes; meaning colour from the labels file.
- [ ] Surface stack follows §9.1 (canvas → sheet → grey card); hierarchy follows §9.2.
- [ ] Type uses §4 roles; titles/numbers `font-light`, nothing bold; changing numbers `.tabular`.
- [ ] Loading skeleton, true-empty, filtered-empty, error line/toast all designed (§11).
- [ ] Motion uses `spring` / `Reveal` / ease-out-expo; lists animate add/remove; reduced motion handled.
- [ ] Submit buttons `type="submit"`; icon buttons labelled; focus visible.
- [ ] Checked at desktop, **375px**, **dark mode**, keyboard-only.

Greppable guard (must print nothing outside the UI primitives and the labels file):

```sh
grep -nE -e '#[0-9a-fA-F]{3,8}\b' -e '(rgb|hsl|oklch)\(' -e 'rounded-\[' \
  -e '\b(bg|text|border|ring|fill|stroke|from|via|to|outline|divide|shadow)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b' <files>
```

---

## 18. Quick start prompt for a new project

Paste into the new project's `CLAUDE.md`:

```md
## Design
Follow @DESIGN.md exactly (copied from the line-art monochrome system). Install tokens from §2 into globals.css first.
Stack: Next.js + Tailwind v4 + shadcn (Base UI) + Motion. Every control is a shadcn component restyled via tokens only.
Do not invent colours, radii, shadows or gradients. For each list build loading, empty, filtered-empty and error states.
Verify at desktop, 375px and dark mode before finishing.
```
