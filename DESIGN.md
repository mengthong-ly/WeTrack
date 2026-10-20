# WeTrack design system

The single source of truth for how WeTrack looks, moves and reads. **Read this before building or
changing any UI.** If something you need isn't here, reuse the closest existing pattern, then add it
to this file in the same change.

Inspiration: soft, rounded mobile task apps (taskdoo, Mote, monochrome expense trackers) adapted
to the web. Stack: shadcn/ui on **Base UI** (style `base-nova`, base colour neutral), Tailwind v4,
Motion (`motion/react`), lucide icons, Geist.

---

## 1. Principles

1. **Calm and monochrome.** Black, white and soft greys carry the whole UI. Colour is used only
   for *meaning*: priority, status, health, project dots. Never for decoration.
2. **Soft and rounded.** Large radii, no hard borders between surfaces. Surfaces separate by tone
   (grey canvas, white sheet, grey card), not by lines.
3. **Big light numbers, small quiet labels.** Key numbers are large and `font-light`. Labels are small
   and muted.
4. **Generous space, few things per screen.** Prefer one clear section over many dense ones.
5. **Motion explains change.** Things rise in, reorder smoothly and count up. Motion never
   decorates or slows the user down.
6. **Edit in place.** Values are changed where they're shown (inline selects, save on blur). There are
   no separate "edit" screens.

---

## 2. Tokens

All tokens live in `app/globals.css`. Use the Tailwind utility; never hard-code the value.

### Colour (CSS variables, light and dark defined)

| Token | Utility | Use |
|---|---|---|
| `--background` | `bg-background` | Page canvas: soft grey (`oklch(0.955 0 0)`). |
| `--card` | `bg-card` | White **sheets**, tiles, dialogs, inputs on grey. |
| `--muted` | `bg-muted`, `bg-muted/60–80` | Grey **cards inside a white sheet**, hover fills, chips' track. |
| `--foreground` | `text-foreground`, `bg-foreground` | Text, the dark FAB, active pill, filled checkboxes, progress fill. |
| `--muted-foreground` | `text-muted-foreground` | Secondary text, labels, meta lines. |
| `--mist` | (body background) | The faint teal haze at the top-left of every page. Don't reuse elsewhere. |
| `--destructive` | `text-destructive` | Form errors and destructive menu items only. |

**Semantic colours are defined once in `lib/labels.ts`** (`STATUS`, `PRIORITY`, `HEALTH`, `PROJECT_HEALTH`) and
must be read from there:

| Meaning | Colour |
|---|---|
| Urgent / Overdue / Blocked | red-600 (dark: red-400) |
| Due soon | amber-600 |
| In progress | orange-600 |
| Review / Test | violet-600 |
| Completed / On track | emerald-600 |
| Normal priority | blue-600 |
| Project behind / at risk / on track | red / amber / emerald (`PROJECT_HEALTH`, with a solid `dot`) |
| Not started / No rush / No deadline | `text-muted-foreground` |

Project colours come from `PROJECT_COLORS` in `lib/labels.ts` and appear only as a small dot (`ProjectDot`).

### Radius scale

| Utility | Size | Use |
|---|---|---|
| `rounded-full` | pill | Buttons, inputs, selects, chips, nav, avatars, icon buttons. |
| `rounded-row` | 1.25rem | List rows: sub-tasks, comment bubbles, checklist items, history rows, calendar day cells. |
| `rounded-panel` | 1.5rem | Inner panels: details box, message textarea, share-link box. |
| `rounded-card` | 1.75rem | Task cards and empty-state boxes. |
| `rounded-tile` | 2rem | Stat tiles, project cards, standalone cards, dialogs, auth card. |
| `rounded-sheet` | 2.5rem | The large white sheets that hold lists on a page. |

Never write `rounded-[…rem]` in app code. If you need a new size, add a token.

### Typography (Geist)

| Role | Classes |
|---|---|
| Page title | `text-3xl sm:text-4xl font-light tracking-tight` |
| Task title on detail | `text-4xl sm:text-5xl font-light tracking-tight` |
| Big number (tiles, %) | `text-5xl sm:text-6xl font-light tracking-tight` inside `<CountUp>` |
| Section heading | `text-lg` (regular weight) |
| Card title | `text-lg sm:text-xl leading-snug` |
| Body | `text-sm` / `text-base` |
| Meta, labels | `text-xs` or `text-sm` + `text-muted-foreground` |

Use `font-medium` only for the logo, chips and tiny emphasis. Never use bold. Wrap figures that change in
`.tabular` (tabular numbers).

### Spacing and layout

- Page shell: `mx-auto max-w-6xl px-4 sm:px-8 pt-6 sm:pt-10 pb-40`. The bottom padding clears the dock.
- Page sections stack with `gap-6`–`gap-8`. Cards in a list stack with `gap-2.5`.
- Padding: sheets `p-3 sm:p-4` (when holding cards) or `p-6` (when holding text), tiles `p-5 sm:p-6`,
  task cards `p-4 sm:p-5`.
- Grids: tiles `grid-cols-2 lg:grid-cols-4`. Main + side column: `lg:grid-cols-3` with the main column `lg:col-span-2`.
- Must work at **375px** with no horizontal scroll.

### Elevation

Flat by default. `shadow-sm` on white sheets and cards. `shadow-md` only on hover for clickable cards.
`shadow-lg`/`shadow-xl` only for floating chrome (dock, FAB). Floating glass:
`bg-card/70 ring-1 ring-foreground/5 backdrop-blur`.

### Motion

Constants live in `components/motion-bits.tsx` and the `--ease-out-expo` token.

| Token | Value | Use |
|---|---|---|
| `spring` | stiffness 380, damping 32 | Layout moves, pills (`layoutId`), checkbox fill, list items, FAB press. |
| ease-out-expo | `[0.16, 1, 0.3, 1]` | Entrances, progress bars, count-ups. |
| Entrance | 0.5s, rise 12px and fade (`<Reveal index>`) | Page sections; stagger 0.06s per index. |
| List stagger | 0.035s per item, capped at 8 items | Task cards. |
| Exit | ≤ 0.2s fade and scale 0.97 | Removing items. |

Rules: animate only `opacity`, `transform`, `width` (progress) and layout. Lists that change use
`<AnimatePresence mode="popLayout">` + `layout`. Always respect reduced motion (`useReducedMotion`,
as `CountUp` does). Never delay an action's result behind an animation.

---

## 3. Surfaces: how a page is built

```
canvas (bg-background, haze)
├── page header: title (font-light) + muted subtitle
├── stat tiles (bg-card/60, rounded-tile) on the canvas
└── sheet (bg-card, rounded-sheet, shadow-sm)
    └── cards (bg-muted/80, rounded-card): grey on white, the taskdoo inversion
```

The **dock** (floating pill nav and dark round "+" FAB) is fixed at the bottom on every signed-in page.
Read-only pages (`/r/[token]`) have no dock and show a "Read-only" pill in the header.

---

## 4. Components: reuse before you build

| Need | Use | File |
|---|---|---|
| Number with label + corner meta | `StatTile` | `components/stat-tile.tsx` |
| A task in a list | `TaskCard` / `TaskList` (`readOnly` for public pages) | `components/task-card.tsx` |
| Segmented filter / tabs that are links | `PillTabs` (animated `layoutId` pill) | `components/pill-tabs.tsx` |
| Any select / picker | `Pick` (wraps Base UI Select; `variant="ghost"` for inline edit) | `components/pick.tsx` |
| Start → deadline in a form | `DateRangePicker` (range calendar in a popover; posts `startDate` + `deadline`; one day = due date) | `components/date-range-picker.tsx` |
| Long-form text (descriptions) | `RichText` (Tiptap; stores **Markdown**; `name` for forms, `onBlur` for inline edit). Content styles: `.rich` in `globals.css` | `components/rich-text.tsx` |
| Markdown → preview line | `plainText()` (used by `toCard`) | `lib/markdown.ts` |
| Calendar / popover primitives | `Calendar` (react-day-picker), `Popover` | `components/ui` |
| Priority flag chip | `PriorityChip` | `components/bits.tsx` |
| Status as coloured text | `StatusText` | `components/bits.tsx` |
| Person | `UserAvatar` (initials fallback) | `components/bits.tsx` |
| Project health (Behind / At risk / On track) | `HealthBadge`; rule is `projectHealth()` in `lib/schedule.ts` | `components/bits.tsx` |
| Projects with health, progress, next due | `ProjectHealthList` (Home, CEO page) | `components/project-health-list.tsx` |
| Overdue / blocked / quiet / unowned work | `AttentionList` + `needsAttention()` | `components/attention-list.tsx` |
| Per-person load (in progress, due 7d, overdue, done this week) | `Workload` + `workload()`; columns are fixed widths so separate row grids line up | `components/workload.tsx` |
| Tasks by status, drag to move | `TaskBoard` (native drag and drop + a "Move to" menu for keyboard and touch; cards use `layoutId`) | `components/task-board.tsx` |
| Dense tasks table by priority | `TaskTable` (collapsible groups, "Add task" row prefills priority) | `components/task-table.tsx` |
| Month calendar + day sheet | `TaskCalendar` (chips on the deadline day, day opens a `Sheet` with a `TaskList`) | `components/task-calendar.tsx` |
| Side panel over the page | `Sheet` (shadcn, Base UI dialog), `bg-card`, `sm:rounded-l-tile`, `sm:max-w-md` | `components/ui/sheet.tsx` |
| Tasks page params, date groups, month grid | `readParams()`, `groupByDate()`, `monthGrid()` | `lib/task-views.ts` |
| Jump anywhere / run an action | `CommandMenu` (⌘K; header trigger) | `components/command-menu.tsx` |
| Fields typed into a title | `parseCapture()` (`#project @person due fri !urgent`), shown as "Picked up" chips | `lib/quick-capture.ts` |
| Project marker | `ProjectDot` | `components/bits.tsx` |
| Progress | `ProgressBar` (animated) | `components/motion-bits.tsx` |
| Animated number | `CountUp` | `components/motion-bits.tsx` |
| Section entrance | `Reveal index={n}` | `components/motion-bits.tsx` |
| Copy-to-clipboard | `CopyButton` | `components/share-link-card.tsx` |
| Primitive controls | `components/ui/*` (shadcn, Base UI) | `components/ui` |

Recurring one-offs to copy, not reinvent:
- **Round icon button**: `grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur hover:bg-card`.
- **Round checkbox**: `size-5`/`size-6` circle, `border-[1.5px] border-foreground/30`, filled `bg-foreground` with an SVG tick (see `TaskCard`).
- **Empty state**: `rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground`, with one sentence that says what to do next.
- **Properties panel** (create dialog): `rounded-panel bg-muted/60 p-1.5`, `sm:grid-cols-2` rows of muted icon + label +
  ghost `Pick` whose hover fill is `bg-card` (see `Prop` in `new-task-dialog.tsx`).
- **Editor toolbar**: `size-8` round icon buttons, muted; pressed = `bg-foreground text-background`; groups split by a
  `h-4 w-px bg-foreground/10` rule. Buttons `preventDefault` on mousedown so the selection stays.
- **Shortcut hint**: `kbd` chips `h-5 min-w-5 rounded-md bg-muted text-[11px]`, hidden below `sm`.
- **Table rows** (inside a sheet): `h-11` cells, `border-t border-foreground/5` hairlines (the one place lines are
  allowed: rows on one surface, never between surfaces), opaque `bg-card` with `group-hover:bg-muted` so the pinned
  first column stays solid. Fixed column widths, title takes the rest, `min-w-4xl` and `overflow-x-auto` on the sheet
  so phones scroll the table, never the page. Group header: chevron + `PriorityChip` + muted count.
- **Calendar cell**: `rounded-row bg-muted/50` (outside the month `bg-muted/20`), date in a `size-6` circle (today
  `bg-foreground text-background`, past days muted). `sm+`: up to 3 `bg-card` pill chips with a `ProjectDot`, then
  "+N more". Phones: dots only. The month slides 16px in from the side you moved to (0.3s ease-out-expo).
- **Press feedback**: small pill and icon buttons get `active:scale-95` (cells and rows `active:scale-97`), with
  `transition-[background-color,scale]`.
- **Stretched link card**: title `<Link>` with `after:absolute after:inset-0`. Inner interactive elements get `relative z-10`.

---

## 5. Interaction patterns

- **Inline edit**: selects save on change, text saves on blur, dates save on change. Errors go to a
  `toast.error`. Success is silent unless it's a create or delete.
- **Optimistic toggles** (`useOptimistic`) for checkboxes and sub-tasks. The server result reconciles.
- **Shortcuts**: **C** new task, **⌘/Ctrl + K** command menu, **/** focuses task search, **Esc** clears it.
  Single-key shortcuts ignore key presses in fields (`isTyping` in `lib/utils.ts`).
- **Tasks views**: `?view=date|priority|board|calendar` (date is the default, so it's left out of the URL) and
  `?status=open|active|done|all` (all is the default). Old `?view=<status>`, `?view=mine` and `?layout=board` links
  still work. Search, person and project filters apply to every view.
- **Board columns**: `rounded-tile bg-card/60` (the stat tile surface) holding white `rounded-card` cards with `shadow-sm`.
  The drop target gets `ring-2 ring-foreground/15`. Empty column: dashed `border-foreground/10` box with one line of help.
- **Create** happens in a dialog (`rounded-tile`, big borderless `font-light` title input, properties panel).
  **C** opens "New task" anywhere; **⌘/Ctrl + Enter** submits.
- **Destructive actions**: in a `DropdownMenu` (`variant="destructive"`), confirmed with `confirm()`.
- **Toasts**: `sonner`, top-centre, short past tense ("Task added"), with an action button when useful ("Open").
- **Errors in forms**: one line under the field group, `text-sm text-destructive`, `role="alert"`.

## 6. Base UI gotchas (shadcn `base-nova`)

- `Button` defaults to **`type="button"`**. Every submit button needs `type="submit"`.
- Compose with the **`render` prop**, not `asChild`. When rendering a non-button (e.g. `<Link>`),
  pass `nativeButton={false}`.
- `Select` shows labels via its `items` prop. Use `Pick`, which handles that.
- `DropdownMenuLabel` (and other menu group parts) must sit inside a `DropdownMenuGroup`, or Base UI throws.
- Pill rows that may outgrow the screen and use `self-start` also need `max-w-full`, or they push the page wider than
  375px.
- Filters and tabs on one page: change the URL with `window.history.pushState` and read it with
  `useSearchParams` (see `TaskBrowser`). A `<Link>` to `?param=` re-renders the whole page on the server
  and replays every entrance animation.
- Keyboard handlers: `event.key` can be undefined (autofill), so use `event.key?.toLowerCase()`.

## 7. Accessibility

- Every icon-only button has an `aria-label`. Toggles use `aria-pressed` or `role="checkbox"` + `aria-checked`.
- Keep the `focus-visible` rings (`ring-3 ring-ring/50`). Never remove outlines without a replacement.
- Touch targets ≥ 40px (`h-10`/`size-11` for primary controls).
- Text colour must keep WCAG AA contrast. Never put semantic colour on `bg-muted` at `text-xs` with a lighter shade.
- Public pages: `robots: noindex`, `referrer: no-referrer`.

## 8. Voice

Sentence case everywhere. Short, plain, human: "Nothing in progress. Pick something from Up next."
Say what happened or what to do next. No exclamation marks, no jargon ("activity row", "token").

---

## Before you ship UI

- [ ] Reused an existing component or pattern from §4. Anything new is added to this file.
- [ ] Only tokens: no `rounded-[…]`, no raw hex, semantic colour from `lib/labels.ts`.
- [ ] Surfaces follow §3 (canvas → sheet → card).
- [ ] Motion uses `spring` / `Reveal` / ease-out-expo, and lists animate add and remove.
- [ ] Works at 375px, in dark mode, with keyboard only and with reduced motion.
- [ ] Submit buttons have `type="submit"`. Icon buttons have labels.
- [ ] Checked in the browser (light, dark, phone width).
