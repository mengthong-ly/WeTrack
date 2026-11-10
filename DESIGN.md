# WeTrack design system

The single source of truth for how WeTrack looks, moves and reads. **Read this before building or
changing any UI.** If something you need isn't here, reuse the closest existing pattern, then add it
to this file in the same change.

The app opens **dark** (`defaultTheme="dark"`): near-black canvas, a faint dot grid, `#151515` tiles and quiet 8% hairline outlines, an isometric line-art look. Light stays available.

Inspiration: **coss.com** (Cal.com's coss ui on Base UI): a neutral sidebar beside an inset white panel, alpha
hairlines, a 10px radius scale, quiet geometric type. Its tokens were lifted from coss.com's compiled CSS (§2).
Stack: shadcn/ui on **Base UI** (style `base-nova`, base colour neutral), Tailwind v4, Motion (`motion/react`),
**animate-ui** icons for navigation and header chrome (`components/animate-ui/icons`, registry `@animate-ui`;
add more with `pnpm dlx shadcn@latest add @animate-ui/icons-<name>`), lucide icons everywhere else,
**Google Sans** (UI text) + **Poppins** (headings, big numbers).

---

## 1. Principles

1. **Calm and monochrome.** Black, white and soft greys carry the whole UI. Colour is used only
   for *meaning*: priority, status, health, project dots. Never for decoration.
2. **Crisp and quiet.** A small radius scale (8–16px) and 1px alpha hairlines. White surfaces on the white panel
   separate by a hairline ring (`shadow-sm`), grey cards inside them by tone (`bg-muted`).
3. **Big light numbers, small quiet labels.** Key numbers are large and `font-light`. Labels are small
   and muted.
4. **Generous space, few things per screen.** Prefer one clear section over many dense ones.
5. **Motion explains change.** Things rise in, reorder smoothly and count up. Motion never
   decorates or slows the user down.
6. **Edit in place.** Values are changed where they're shown (inline selects, save on blur). There are
   no separate "edit" screens. The one exception is the 3D workspace, where a thing's drawer is a calm
   summary and every change opens as a **nested drawer** on top (see `Layer` in §4).

---

## 2. Tokens

All tokens live in `app/globals.css`. Use the Tailwind utility; never hard-code the value.

### Colour (CSS variables, light and dark defined)

| Token | Utility | Use |
|---|---|---|
| `--background` | `bg-background` | The inset panel: white (`#fff`; dark `#0e0e0e`, under a faint dot grid set on `[data-slot="sidebar-inset"]` in `globals.css`). |
| `--sidebar` | `bg-sidebar` | The frame around the panel and the sidebar: `#fafafa` (dark `#090909`). Also the body (auth pages). |
| `--card` | `bg-card` | **Sheets**, tiles, dialogs: white on white, shown by the `shadow-sm` hairline ring. Dark: `#151515`, a step above the panel. |
| `--muted` / `--accent` | `bg-muted`, `bg-accent` | 4% ink (`#0000000a`; dark 4% white): grey cards inside a sheet, hover fills, chip tracks. |
| `--border` / `--input` | `border`, `border-input` | 8% / 10% ink hairlines (dark 15% / 20% white: the outlines carry the dark look). |
| `--foreground` / `--primary` | `text-foreground`, `bg-primary` | neutral-800 ink (`#262626`; dark `#f5f5f5`): text, New task, active pill, filled checkboxes. |
| `--muted-foreground` | `text-muted-foreground` | `#686868` (dark `#818181`): secondary text, labels, meta. |
| `--destructive` | `text-destructive` | Form errors and destructive menu items only. |
| `--info` / `--success` / `--warning` (+ `-foreground`) | `text-success-foreground`, `bg-warning/10`… | coss's status set (blue / emerald / amber), for alerts and badges. Task meaning still comes from `lib/labels.ts`. |

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

Project colours come from `PROJECT_COLORS` in `lib/labels.ts` and appear only as a small dot (`ProjectDot`). A project with a
logo shows it instead where the project is the subject (project card, 3D token) via `ProjectMark`; lists keep the dot.

### Radius scale

Line-art look: every surface (panel, card, tile, sheet, `rounded-lg`) is one **14px** radius; only list rows stay at 8px.

| Utility | Size | Use |
|---|---|---|
| `rounded-full` | pill | Buttons, inputs, selects, chips, nav, avatars, icon buttons. |
| `rounded-lg` | 0.875rem (`--radius`) | Sidebar rows, header buttons, the search field, shadcn controls. |
| `rounded-row` | 0.5rem | List rows: sub-tasks, comment bubbles, checklist items, history rows, calendar day cells. |
| `rounded-panel` | 0.875rem | Inner panels: details box, message textarea, share-link box. |
| `rounded-card` | 0.875rem | Task cards and empty-state boxes. |
| `rounded-tile` | 0.875rem | Stat tiles, project cards, standalone cards, dialogs. |
| `rounded-sheet` | 0.875rem | The large sheets that hold lists on a page. |

Never write `rounded-[…rem]` in app code. If you need a new size, add a token.

### Typography (Google Sans + Poppins)

`--font-sans` is Google Sans (400–700; it has no light weight). `--font-heading` is Poppins (300–600), applied to
every `h1`/`h2` in `globals.css` and by `font-heading` for big numbers and the logo mark, so `font-light` titles keep
their 300. Both load in `app/layout.tsx`; to run on Poppins alone, point `--font-sans` at `--font-poppins`.

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

- Page shell: inside `SidebarInset`, under the `h-14` header: `px-4 py-6 sm:px-8 sm:py-8`. A page that fills the panel
  (the 3D workspace) is `absolute inset-x-0 top-14 bottom-0`; the inset is the positioned, `overflow-clip` box.
- Page sections stack with `gap-6`–`gap-8`. Cards in a list stack with `gap-2.5`.
- Padding: sheets `p-3 sm:p-4` (when holding cards) or `p-6` (when holding text), tiles `p-5 sm:p-6`,
  task cards `p-4 sm:p-5`.
- Grids: tiles `grid-cols-2 lg:grid-cols-4`. Main + side column: `lg:grid-cols-3` with the main column `lg:col-span-2`.
- Must work at **375px** with no horizontal scroll.

### Elevation

Flat by default. `shadow-sm` is redefined as coss's **hairline ring** (`0 0 0 1px var(--border)` + a 2px soft drop) and
`shadow-md` as the ring + a 12px drop, so every sheet and card gets a border with no class changes. `shadow-sm` on
sheets and cards, `shadow-md` only on hover for clickable cards.
`shadow-lg`/`shadow-xl` only for floating chrome (menus, the scene's bottom bar). Floating glass:
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
| Page change | none: the new page swaps in at once and its `<Reveal>`s rise | Every route change. |

Rules: animate only `opacity`, `transform`, `width` (progress) and layout. Lists that change use
`<AnimatePresence mode="popLayout">` + `layout`. Always respect reduced motion (`useReducedMotion`,
as `CountUp` does). Never delay an action's result behind an animation.

**Overlays move on Animate UI** (`@animate-ui/react/primitives/base-ui/*`, on Motion), as the WeShop vendor portal does:
`ui/` dialog, sheet, drawer, dropdown-menu, popover, select and tooltip import their primitive from there instead of
`@base-ui/react` (same API, plus `transition` / `from` props). Menus and popovers spring from their trigger, dialogs
and sheets spring in from their side, the drawer stack keeps its `--translate-*` / `--stack-scale` variables. Never add
`animate-in`/`animate-out`, `fade-*`, `zoom-*`, `slide-in-*` or `data-starting-style` / `data-ending-style` transitions to
these; Motion owns them and handles reduced motion.

**No page transitions.** A route change swaps the page in at once; the page's own `<Reveal>`s give the entrance and a
`loading.tsx` skeleton covers a slow server. Don't wrap pages in React `<ViewTransition>` or call `startViewTransition`: every
navigation commits several times (skeleton, page, streamed parts), and each commit froze the whole screen into a snapshot that
ignored clicks, so tabs, tasks and feedback felt like they glitched.

**Pages render as a static shell plus streamed data** (Cache Components + Partial Prefetching). The
layout's frame (sidebar, header, tool shapes) and each area's `loading.tsx` are prefetched with every link,
so a click paints at once. Anything that reads the signed-in user goes inside a `<Suspense>` with a
skeleton from `page-skeleton.tsx`, never at the top of a layout. Heavy client code (three.js, Tiptap,
the calendar) loads on demand or in idle time, never with the page.

---

## 3. Surfaces: how a page is built

```
canvas (bg-background, haze)
├── page header: title (font-light) + muted subtitle
├── stat tiles (bg-card/60, rounded-tile) on the canvas
└── sheet (bg-card, rounded-sheet, shadow-sm)
    └── cards (bg-muted/80, rounded-card): grey on white, the taskdoo inversion
```

**Projects come first, then tasks.** The app has two modes, each its own layout with its own sidebar, inside one coss.com
frame (`Frame` in `app/(app)/frame.tsx`, `components/app-sidebar.tsx` on shadcn `Sidebar`, `variant="inset"`,
`collapsible="icon"`). `SidebarProvider` sits in `app/(app)/layout.tsx`, above both, so a collapsed sidebar stays collapsed
across the switch. URLs come from `lib/routes.ts` (`projectHref`, `tasksHref`, `taskHref`, `newTaskHref`, `feedbackHref`,
`updatesHref`); never write a project or task path by hand.

| | Project selection mode | Task management mode |
|---|---|---|
| Layout | `app/(app)/(org)/layout.tsx` (`OrgSidebar`) | `app/(app)/(project)/projects/[projectId]/layout.tsx` (`ProjectSidebar`) |
| Routes | `/projects` (where everyone lands; `/` redirects there), `/workspace`, `/meetings`, `/team`, `/archive` | `/projects/<id>` Overview, `/tasks`, `/tasks/<taskId>`, `/tasks/new`, `/feedback`, `/feedback/<id>`, `/feedback/new`, `/updates` |
| Sidebar head | "w." mark, WeTrack, team name | "← All projects" (`size="sm"`, muted), then the project as a `size-8 rounded-lg border` tile (logo or colour dot), its name and "Project" / "Archived project" |
| Call to action | dark **New project** row (`NewProject variant="sidebar"`; creating one goes straight into it) | dark **New task** row (`C` kbd, fires `NEW_TASK_EVENT`) |
| Nav | "Navigate": Projects, Workspace, Meetings, Team, Archive | "Project": Overview, Tasks, Feedback, Client updates |
| Switcher text | "Select a project" (muted dot) | the project's name and dot |

- **Switching modes** is a navigation: the new layout mounts and its sidebar content slides in 12px from the left and fades
  (`ModeSwitch`, 0.35s ease-out-expo, fade only with reduced motion). Within a mode nothing moves.
- **The sidebar moves like animate-ui's** (`components/ui/sidebar.tsx`; animate-ui only ships a Radix sidebar, so its
  effect is ported onto this Base UI one): one `bg-sidebar-accent` fill glides between rows on hover (`Highlight`
  from `components/animate-ui/primitives/effects/highlight.tsx`, parent mode, spring 350/35, fades out 0.2s after the
  pointer leaves), and collapsing to the icon rail eases with a small overshoot (`duration-400`,
  `cubic-bezier(0.7,-0.15,0.25,1.15)`). Every `SidebarMenuButton` is a `HighlightItem`; its static hover fill only
  applies without a highlight (`not-data-highlight:`). `HighlightItem` writes `data-active="true|false"`, so menu
  buttons carry `data-active` explicitly and are styled with `data-[active=true]:` (never the presence-only
  `data-active:`).
- **The sidebar is set in Poppins** (`font-heading` on `ModeSwitch`, so both modes and the phone sheet). **Sidebar rows** are animate-ui icons that play when the row is hovered (`AnimateIcon animateOnHover asChild` around
  `SidebarMenuButton`); the account row (`UserMenu`: avatar, name, email, chevrons) sits at the foot. ⌘B or the header
  toggle collapses it to a 3rem icon rail with names in `side="right"` tooltips. Below `md` it's a sheet that closes when
  a link is picked. Parts that read the URL (`ProjectNav`, `NewTaskHost`) sit inside `<Suspense>`; the project nav's
  fallback is `SidebarMenuSkeleton` rows (fixed width: a random one breaks prerendering).
- **Inset panel** (`SidebarInset`, `min-w-0` so wide page rows can't stretch it): white, `rounded-xl`, `m-2`, hairline.
  Its sticky `h-14` header (`AppHeader`, `border-b bg-background/85 backdrop-blur`): `SidebarTrigger`, a vertical
  `Separator`, the **project switcher** (`ProjectSwitcher`: coss `Button variant="outline"` as a coss `Menu` trigger:
  folder icon, team name, `/`, the project's `ProjectDot`, its name, `ChevronsUpDownIcon`; below `sm` only the project.
  Its `MenuPopup` is Spotlight-sized (`w-[min(26rem,…)]`, `rounded-sheet`, frosted `bg-popover/85 backdrop-blur-xl`,
  `min-h-11 rounded-row` rows in `text-base`, `size-2.5` dots, a `size-11` header tile): team header with the project count, "Project" links with a tick on the current one, then "All
  projects" and "New project" (`/create`). Switching keeps your section: Tasks
  stays Tasks; a task or a point goes to its list), then on the right the **search** (coss outline `Button`, `sm:w-60`,
  "Search…", a `KbdGroup` of separate ⌘ and K keys; an icon button on phones; fires `SEARCH_EVENT`) and the **bell**
  (`Inbox`, `size-8 rounded-lg` ghost).
- **New task needs a project.** `NewTaskHost` opens `newTaskHref(preset.projectId ?? the project you're in)`. With
  neither (C, or a workspace panel's New task, while picking a project) it shows "Pick a project first" and goes to
  `/projects`. ⌘K lists the project's pages and actions only while you're in one.
- **The picker** (`/projects`): a **data table page** (§4): `PageHead` "Projects *n*" with Home's greeting and your-work
  line as its description and **New project**; filter tabs All / With your work / Overdue, search; the table (`ProjectTable`,
  `components/project-table.tsx`): mark + name (the row steps into the project) with a "done · yours" line, health dot,
  progress bar and %, open, overdue, next due, and a Client updates icon link (a dot while there's something to tell). Every
  project is already loaded, so filtering and paging happen on the client (`?q=`, `?show=`, `?page=`). Meetings live on
  `/meetings`.
- **Overview** (`/projects/<id>`): the project name as the `h1` with "Yours here · …", then **Continue** (your tasks in this
  project: the one you're on as a `TaskCard`, "Up next" compact rows, "All tasks") beside a **Progress** sheet (health,
  big %, `ProgressBar`, open / done / overdue / next due, a `rounded-row bg-muted/60` Client updates row).
- **Old links redirect** (route handlers in `app/(app)/(org)`): `/tasks/<id>` and `/feedback/<id>` look up the project
  (notifications, emails, Slack and `sw.js` still build those), `/tasks?project=` keeps its filters, `/tasks/new?projectId=`
  keeps its preset, `/feedback/new?task=` follows the task; anything without a project goes to `/projects`. A task page
  opened under the wrong project redirects to the right one.
- **Feedback belongs to a project** (`feedback.project_id`: the task's project, or the project it was given in; it moves
  with its task). Points from before this that named no task have none and show nowhere.
- Focus pages keep the frame; their `Crumbs` row sits under the header ("Tasks" is the project's task list).

**coss ui** (`components/coss/`) is vendored from coss.com's registry (`https://coss.com/ui/r/<name>.json`): button,
input, input-group, textarea, kbd, menu, spinner. Its outline controls carry the coss **edge light**: a `before:` layer
with a 1px inner line (light: `0 1px black/4%` at the foot; dark: `0 -1px white/6%` at the top) on `bg-background`
(dark `bg-input/32`), `border-input`, `shadow-xs/5`, `rounded-lg`. Use these where you want that look; `components/ui`
stays shadcn. Don't `shadcn add` coss items: its `@coss/*` dependencies collide with `components/ui` names and get
wired to the wrong files. Fetch the JSON, write `content` to `components/coss/<name>.tsx`, and rewrite
`@/registry/default/ui/` → `@/components/coss/` and `@/registry/default/lib/utils` → `@/lib/utils`.
Read-only pages (`/r/[token]`) have no sidebar and show a "Read-only" pill in the header.

---

## 4. Components: reuse before you build

| Need | Use | File |
|---|---|---|
| Number with label + corner meta | `StatTile` | `components/stat-tile.tsx` |
| A task in a list | `TaskCard` / `TaskList` (`readOnly` for public pages, `compact` for one-line rows) | `components/task-card.tsx` |
| Sub-tasks | A sub-task is a **full task** with `parent_id` (any depth; deleting a task deletes everything under it). It takes its parent's project; `addSubtask(parentId, title)` is the quick add, ticking is `updateTask` (completed / not started). Task lists, tables and the grid show top-level tasks and count the children; workload, attention and the 3D workspace count every task. `placeInTree()` (`lib/task-tree.ts`) gives a task its ancestors and its family from the root | `lib/task-tree.ts`, `app/actions.ts` |
| Segmented filter / tabs that are links | `PillTabs` (animated `layoutId` pill) | `components/pill-tabs.tsx` |
| Any select / picker | `Pick` (wraps Base UI Select; `variant="ghost"` for inline edit) | `components/pick.tsx` |
| Long-form text (descriptions, comments, feedback) | `RichText` (Tiptap; stores **Markdown**; `name` for forms, `onBlur` for inline edit, `onSubmit` for ⌘/Ctrl + Enter, `onReady` hands over the editor, `editable={false}` to show saved text, which renders as written until Tiptap loads). Blocks: text, headings 1–3 (`# `, `## `, `### `; sized `text-3xl` / `text-2xl` `font-light` / `text-lg`, never bold), bulleted / numbered list, checklist (`- [ ]`, the round checkbox), quote, code block, divider, image. Images (paste, drop or the Image block) need `onImage(blob) → src`: `uploadTo` (`lib/image.ts`) stores them as an `attachment` (`lib/storage.ts`: a private Cloudflare R2 bucket when `R2_*` is set, otherwise the row), served to the workspace only from `/api/attachments/[id]`. No toolbar, see **Editor chrome**. Always load it with `next/dynamic`. Content styles: `.rich` in `globals.css` | `components/rich-text.tsx` |
| Focus page layout (task, New task, Give feedback) | `FocusLayout` (`title`, `side`, `tabs?`, `contents?`, children): the document in the middle, an optional sticky `contents` column on the left (`w-56`, from a `@6xl` container) and a sticky side panel on the right (`@4xl` container: `w-72 rounded-panel bg-card p-2 shadow-sm`, its own scroll when taller than the screen), **open by default**. The panel holds the page's fields as a `SideSection` (small muted label over a `rounded-row bg-muted/60 p-1` group) of `SideProp` rows (`min-h-11`: muted icon + `w-16` label, then a ghost `Pick`, flush and `hover:bg-card`, a date input or a plain value), then the **Text** settings: three font tiles (Sans / Serif / Mono, "Aa" in each, `h-18 rounded-row bg-muted/60`, pressed = `bg-foreground text-background`), tick rulers for font size (13–22px), line spacing (1.2–2.2) and editor width (50–100%) (a native range input under `rounded-row bg-muted/60` ticks; the current tick full height, the rest `scale-y-50 bg-foreground/20`), a `PillTabs` Text / Markdown switch (Markdown shows the source in a plain textarea that writes back to the editor) and a Reset link once anything differs. `PanelToggle` (a `RoundButton` with `PanelRightIcon`) in the page header hides the panel. Narrow (phones, the workspace sheet) the main column and panel turn `contents` and stack as title, fields, document, text settings, each part its own `bg-card` panel; the toggle then hides only the text settings. The body `RichText` goes in an `EditorSheet` (`rounded-panel bg-card p-5 shadow-sm`), the only place text settings apply (CSS `[data-tuned]` in `globals.css`), never comments or read-only notes. With `tabs`, the panel opens on `PillTabs` across its top (Info = `side`, Style = the text settings, then the page's own, e.g. Comments) whose content swaps without animating, and narrow it follows the document as one card. A page that draws its own document sheet wraps the `RichText` in `Tuned` instead of `EditorSheet`. Settings are per browser (`wetrack:editor` in localStorage) | `components/editor-tools.tsx` |
| Markdown → preview line | `plainText()` (used by `toCard`) | `lib/markdown.ts` |
| One date in a side panel (task Deadline / Start) | shadcn date picker: `PopoverTrigger` rendered as a ghost `Button` (`h-9 rounded-full`, flush with the `Pick`s, `hover:bg-card`, "Pick a date" muted when empty) + a single-mode `Calendar` in `PopoverContent` (`rounded-tile p-3`); a round X clears it; closes on pick | `DateInput` in `components/task-detail.tsx` |
| Calendar / popover primitives | `Calendar` (react-day-picker), `Popover` | `components/ui` |
| Priority flag chip | `PriorityChip` | `components/bits.tsx` |
| Status as coloured text | `StatusText` | `components/bits.tsx` |
| Person | `UserAvatar` (initials fallback) | `components/bits.tsx` |
| Project health (Behind / At risk / On track) | `HealthBadge`; rule is `projectHealth()` in `lib/schedule.ts` | `components/bits.tsx` |
| Projects with health, progress, next due | `ProjectHealthList` (CEO page) | `components/project-health-list.tsx` |
| Overdue / blocked / quiet / unowned work | `AttentionList` + `needsAttention()` | `components/attention-list.tsx` |
| Team (`/team`) | `TeamTable`: a **data table page** (§4) of everyone with their load from `workload()`: person (avatar, name, email, "· you"), role (`RoleMenu`, the owner changes it in place), open, in progress, due in 7 days, overdue, done this week, all sortable. Tabs Everyone / Owners and admins / With overdue work and search, on the client. The join code, CEO link, Slack and API keys cards follow it | `components/team-table.tsx` |
| Per-person load on the CEO page (in progress, due 7d, overdue, done this week) | `Workload` + `workload()`; columns are fixed widths so separate row grids line up | `components/workload.tsx` |
| Tasks as documents (the Cards view) | `TaskGrid`: an auto-fill grid (`minmax(16rem,1fr)`, `gap-4`) of `h-80 rounded-tile bg-card p-5 shadow-sm` page-shaped cards that open the task: title, a thumbnail of the description (`MiniDoc`) fading out at the foot, then project, status, sub-tasks, deadline and avatar. The server passes the first 1200 characters of the description as `body` | `components/task-grid.tsx` |
| Tasks grouped by priority (the Priority view) | `TaskPriorityTable`: collapsible priority groups, inline status and priority selects (a new priority moves the row to its group), an "Add task" row that prefills priority | `components/task-priority-table.tsx` |
| Tasks as a data table (the default Tasks view) | `TaskTable`: one page of tasks in the server's order (overdue, then deadline); title (whole row opens the task) with a sub-task count, inline status and priority `Pick`s (optimistic), assignee, deadline in its health colour when due soon or late, and a ⋯ row menu (Open task, Delete task with `confirm()`) | `components/task-table.tsx` |
| Side panel over the page | `Sheet` (shadcn, Base UI dialog), `bg-card`, `sm:rounded-l-tile`, `sm:max-w-md` | `components/ui/sheet.tsx` |
| Workspace drawers (nested) | `Layer` on the shadcn `Drawer` (Base UI): a right `rounded-l-tile` card from `sm`, a bottom `rounded-t-tile` sheet with a swipe handle below it; one width (`32rem`) for every drawer so the one behind always peeks out. A `Layer` rendered inside another nests: the one behind shrinks and steps back (shadcn's stack), Esc and swipe close the front one first. Uncontrolled with `trigger`, or `open` / `onOpenChange`. `LayerHead` (optional `size-11` mark, `text-2xl font-light` title, a muted facts line, round Close), `LayerBody` (the one scroll area, `px-6 pb-6`), `Rows` + `Row` (a `rounded-panel bg-muted/60 p-1` group of `h-12 rounded-row` rows: muted icon, label, meta, chevron when it opens a drawer). Routed drawers (`RouteDrawer`: a task, New task, Client updates) live in the `@panel` slot, outside the workspace's tree, so the workspace drawer under one gets `behind` and stacks the same way and ignores close until the front one goes. A routed drawer slides in on arrival (it mounts closed: Base UI skips the animation for a drawer that mounts open), swaps in place when it replaces another (a sub-task, a new task once added), is full height on phones so the sheet doesn't jump as its content streams in, and slides out before going back. Inside one, close with `useCloseRoute()` (TaskDetail's Back and Delete), never a bare `router.back()`, which hides it without the slide | `components/workspace-drawer.tsx` |
| Tasks page params, date groups | `readParams()`, `paramsKey()`, `groupByDate()` | `lib/task-views.ts` |
| Notifications | `Inbox` (the bell at the right of the header, after search): a `bg-foreground` count pill (`h-5 min-w-5`, `.tabular`, "9+") on the bell while there's anything unseen. Opens a `rounded-tile bg-card p-2` `Popover` (`side="bottom"`, under the header): "Notifications" `text-lg`, then the newest 30 as `rounded-row` links (`hover:bg-muted`, `active:scale-99`): avatar, "*Name* verb" (name in foreground, verb muted), the task, meeting or feedback on its own line (two lines max), a muted preview line (a comment's first words, a meeting's time), time ago, and a `size-2 bg-foreground` dot on ones you hadn't seen. Opening it marks everything seen (`markNotificationsRead`): the count goes at once, the dots stay until it closes. A quiet "Show older" pill (`h-9`, `Spinner` while loading) under the list pages back through everything. The bell stays current without a reload: `PushHost` polls `/api/notifications` every 30s while the tab is visible, at once when you come back to it or a push lands, and refreshes the page when something new arrived. Empty: the empty-state box. At its foot, a `rounded-row bg-muted/60` "Push notifications" row with a dark "Turn on" pill (asks the browser only when pressed), `bg-card` "Turn off" once on, or "Blocked in browser settings"; on an iPhone or iPad not yet on the Home Screen, a `ShareIcon` line saying how to add it (iOS only pushes to installed web apps: `app/manifest.ts`, icons in `public/icons` and `app/apple-icon.png`, the logo's "w." on ink); hidden where push isn't supported or VAPID keys aren't set. Written by `notify()` (`lib/notify.ts`) from the actions: assigned to you, a comment / status / deadline change on a task you own or made (comments also reach everyone already in the thread), feedback for you, a meeting you're invited to or that's cancelled; never to the person who did it. Wording and links in `lib/notifications.ts`. Push goes out after the response (`after()`) through `public/sw.js`; a tab you're looking at gets a toast with "Open" instead of a system banner, and every open tab refreshes its bell (`PushHost`). Signing out turns push off for that browser | `components/inbox.tsx` |
| Jump anywhere / run an action | `CommandMenu` (⌘K, or `SearchButton` in the header) | `components/command-menu.tsx` |
| Fields typed into a title | `parseCapture()` (`#project @person due fri !urgent`), shown as "Picked up" chips | `lib/quick-capture.ts` |
| Project marker | `ProjectDot`; `ProjectMark` shows the logo (round, `object-contain`, `bg-card ring-1 ring-foreground/5`, sized by `className`, `size-8` on project cards) or falls back to the dot | `components/bits.tsx` |
| Progress | `ProgressBar` (animated) | `components/motion-bits.tsx` |
| Animated number | `CountUp` | `components/motion-bits.tsx` |
| Section entrance | `Reveal index={n}` | `components/motion-bits.tsx` |
| Image preview | `ImageGallery` wraps a page (task, feedback point, Give feedback): images in Markdown (`.rich img`, kept to `max-h-72` with `cursor-zoom-in`) and anything marked `data-zoom` open on click in a `rounded-tile` dialog (`sm:max-w-5xl`, image `max-h-[75dvh] object-contain`). With more than one image in the page: round prev / next buttons, `size-12 rounded-row` thumbnails (current = `ring-2 ring-foreground`), "2 / 5" from `sm`, ←/→ keys. Switching images doesn't animate | `components/image-gallery.tsx` |
| Copy-to-clipboard | `CopyButton` | `components/share-link-card.tsx` |
| Connect Google Calendar | `ConnectGoogle` (outline button) or `connectGoogle()` for a menu item; account menu shows "Google Calendar connected" as a label once linked, nothing when Google isn't configured | `components/connect-google.tsx` |
| Slack webhook setting (Team, owners and admins) | `SlackCard`: pill input + Connect; once linked, "Posting to Slack" with Replace and Remove (`confirm()`). Takes only `connected`, the URL never reaches the client. Error is one `role="alert"` line under the field | `components/slack-card.tsx` |
| Schedule a Google Meet | `NewMeetingDialog` (mounted once in the app layout with `members`, `meId`, `calendarConnected`, `googleEnabled`) opened by `openNewMeeting({ title?, taskId? })` from ⌘K, task detail ("Schedule meeting" round button) and Home. Date is a single-mode `Calendar` in a `Popover`, Start/End are ghost `Input type="time" step={300}` (next half hour, 30 min; moving the start keeps the length). Under the title, an optional borderless auto-growing `Textarea` description (muted until focused, 2000 chars, also sent to Google). With Slack connected, the footer has a "Post to Slack" `role="checkbox"` pill (round checkbox + label, on by default) before the submit pill; the post is a Block Kit card (`slackMeetingCard` in `lib/meetings.ts`). Not connected: one line + `ConnectGoogle`; Google not configured: one muted line, no form | `components/new-meeting-dialog.tsx` |
| Meeting within the hour | `MeetingBanner` (floating glass `rounded-tile` strip above the page: video icon, "*Title* starts in 45 min" or "is on now", "+N more", dark `h-10` Join pill opening in a new tab). Server passes ISO dates; a 30-second client clock re-checks `bannerState()`, renders nothing on the server or outside the window. Rises 12px ease-out-expo, opacity only with reduced motion | `components/meeting-banner.tsx` |
| Every meeting | `MeetingTable` at `/meetings` (project selection mode): a **data table page** (§4). Tabs Upcoming / Past / Cancelled, search, Mine / Everyone (`?tab=`, `?q=`, `?who=all`, `?page=`), **New meeting** in the head. Columns: when (`.tabular`), title with "by *organizer*", task link, people (avatar stack), and for meetings still to come an outline **Join** and the row menu (Send to Slack, Cancel meeting). Rows from `meetingsPage()` + `meetingItems()` (no Join or Cancel once over or cancelled) | `components/meeting-table.tsx` |
| Upcoming meetings (small) | `MeetingList` (task detail "Meetings" above the tabs in a `rounded-panel bg-card p-2` panel when there are any, `readOnly` on the CEO page). Rows `rounded-row bg-muted/60`: `.tabular` slot, title, member avatars + task link, `bg-card` Join pill (only for invitees, the creator, owners and admins via `canJoin()` in `lib/meetings.ts`; the CEO page shows it on every row), row menu "Send to Slack" (reposts the card; toast "Sent to Slack", or the error when Slack isn't connected) and "Cancel meeting" (`destructive`, `confirm()`, optimistic; leaves with the list exit). The list is an `@container`: narrow (Home column) puts Join and the menu on the avatars line, `@md` and up moves them to the right of the row. Rows come from `meetingItems()` in `lib/queries.ts`, which formats the slot in `APP_TIMEZONE` and sets `canCancel` on the server | `components/meeting-list.tsx` |
| 3D workspace overview | `ProjectScene` (three.js) draws the workspace as **flat line-art blocks** on a dark floor, after the isometric reference. A token is a sharp box seen in perspective: a charcoal `raised` body (paper stepped toward ink), every edge drawn as a 1px ink outline (`EdgesGeometry`, opacity 0.85), its **mark on top as thin line art**, and a mono label engraved on each visible side (name left, a quiet detail right, a project's colour as a dot before its name). The mark is an image as a duotone between the face's two colours (`workspace.logo`, a person's `image`; uploaded images will use the same path), initials (`initials()`, Geist 400) until there is one, or a status glyph (dashed ring, half, three-quarter, cross, filled check). Task blocks are sharp, outlined cubes. Every colour comes from the theme or `lib/labels.ts`, read at mount and repainted when the theme changes, so light and dark both work; nothing is a fixed hex except a project's own colour. The floor is 1px hairline grid lines that fade out before an edge, with soft shadows. Nothing sits along the top: one bar at the bottom holds `PillTabs` for Hub / Flow / Team, round recentre, turn left / right (`sm+`) and play/pause buttons, then the page's own `toolbar` (or a glass "Live / Paused · N open" pill, `sm+`). Below `sm` the views take their own row above the buttons. The selected-item and journey cards sit top-left; the gesture hint top-right (`lg`). Hub: the workspace token at the core (a block with a wireframe-globe line icon, or the workspace logo), a token per project (taller with more open work; its colour is the dot on its side) joined to the core by a 1px ink hairline (outer ring arcs over the inner one); hovering a token lifts it and darkens its line. Flow: a paper tray per status with its glyph at the front edge and blocks stacked behind it, a hairline belt carrying the followed task with a "Following one task" card (step + progress); Focus with nothing picked follows it. Team: a person's token (paper face, ink sides) raised on a stack of slabs, one per open task (in progress / blocked in status colours), plus an Unassigned tray. Meaning sits in a muted, outlined socket under each token (project health, status, red for someone with overdue work) that glows on hover. Names are engraved on the token's left side (cut with an ellipsis), beside the glyph on a tray. Lines are 1px hairlines in the ink colour only (opacity 0.3), never a project or status colour. Task blocks carry their facts: a band at the foot when overdue (red) or due soon (amber), a pin on top when urgent, and the deadline in the tooltip; with `highlight` set, blocks that don't match fade toward the paper, tokens go see-through and labels dim. **Hover**: each item has one invisible hit box (its bounds, extended down by how far it rises, so a lifted token never slips from under the pointer); only those boxes are raycast, and only when the pointer or camera moved. The hovered item alone lifts (ease rate 10, no neighbour motion), its plate glows, and the tooltip glides between items instead of jumping. Hover shows a glass tooltip; click focuses the camera and opens a `rounded-panel` glass card with Open (`linked` only). **Moving around** is map-style (`MapControls`): drag moves along the floor, Shift-drag or right-drag turns (and two round turn buttons beside play, `sm+`, spin the view 45° with an eased turn), wheel or pinch zooms toward the pointer, a sideways two-finger swipe (or Shift + wheel) moves left and right; on touch one finger moves, two turn and zoom. The point you look at is clamped to the current view, and Overview re-centres. Gestures act on the scene, not the page. hairline's `Hub` (`components/ui/hub.tsx`, `@lucasmarkes/hairline`) is the loading poster, the no-WebGL fallback (with Reload) and the empty state. Data from `sceneData()` in `lib/scene.ts`. Reduced motion starts paused (play still works) and skips easing | `components/project-scene.tsx` |
| 3D workspace (manage work in 3D) | `Workspace` at `/workspace` (project selection mode, after Projects). It shows every project; a task from it opens through `@panel/(..)projects/[projectId]/tasks/[taskId]` (and `…/tasks/new`, `…/updates`) as a drawer over the scene, in this mode. `ProjectScene` with `chrome="page"` fills the inset panel under the header (`absolute inset-x-0 top-14 bottom-0`), bottom controls `bottom-3 sm:bottom-4`. Click the core, a project, a status station or a person for its drawer (`Layer`). Each is a calm summary; changes stack on top as nested drawers. **Project**: mark (logo or colour dot on a grey disc), name, health and counts; the big progress %; New task, Edit and a ⋯ menu (Archive project); `Rows` for People (avatar stack) and Client updates (unreported count); the open tasks. *Edit project* (nested): name and `PROJECT_COLORS` swatches saved together by Save (`updateProject`), and a Logo row opening *Logo* (third level: `size-32` preview, Upload / Replace image, Remove; shrunk to 512px, shown at once while it saves). *People* (nested): who has open work here (open, in progress, overdue) and the unassigned count. *Archive* (nested, replaces `confirm()`): Archive project / Cancel, then the project drawer closes. **Core**: New task, New project, All tasks, and `Rows` for CEO link (owners/admins, `ShareLinkCard`) and Archived projects (Restore), each nested. **Status** and **person** drawers list their tasks with a preset New task. A task block, or a task in any drawer, opens the full `TaskDetail` in a `RouteDrawer` through the `@panel/(..)tasks/[id]` intercepting route, stacked over the open drawer; `/tasks/<id>` opened directly is still the page. Client updates opens the same way (`@panel/(..)projects/[id]/updates`, data from `loadClientUpdates()`), and `/projects/<id>/updates` is still the page. Drag a Flow block onto another status station, or an Unassigned block (Team) onto a person: saved with `updateTask`, silent on success, `toast.error` + refresh on failure. New task with the project, status or person filled in starts from its panel (`NEW_TASK_EVENT` detail is a `NewTaskPreset`) and opens the New task page in a `RouteDrawer` over the drawer it came from (`@panel/(..)tasks/new`), which becomes the new task's drawer once added; the scene itself has no floating labels or "+" buttons. Edits refresh the data and the scene rebuilds in place, keeping mode, camera and selection. **Outline** (`nav`, glass `rounded-panel`, `w-72`, closed by default, an overlay with a close button below `lg`; toggled by a round `PanelLeftIcon` button that shows an orange dot while a search or filter is on): a search field (`/` focuses it, Esc clears, own clear button, native cancel hidden), `PillTabs` filters All / Mine / Needs attention (`needsAttention()` ids), and every project, status and person as `h-10 rounded-row` rows that fly the camera there and open the same panel, so keyboards and screen readers reach everything. With a search or filter on, it lists matching tasks (40 max) and the scene dims the rest (`highlight`). **Legend**: round `CircleHelpIcon` button, a `Popover` explaining the three views, the colours and the gestures; it opens by itself once (`wetrack:workspace-intro` in localStorage). The outline toggle and the Legend sit at the end of the scene's bottom bar (the Legend opens upward). The scene runs `calm` here: no Live pill, journey card or hint line, and motion stops at the first touch (Play brings it back). **Archived projects** are listed in the core panel with Restore (`restoreProject`); `listTasks` leaves out archived projects' tasks everywhere | `components/workspace.tsx`, `app/(app)/workspace` |
| Signed in with no team | `GetStarted` on `/onboarding` (auth page): `AuthHeading`, glass `PillTabs` "Join a team" / "Create a team", one form each (`h-12` `authField` input, `pl-4` hint line, `authButton` submit), "Signed in as … Sign out" footer. The join code input is mono, centred, uppercases and adds the dash as you type | `components/get-started.tsx` |
| Join code (Team, owners and admins) | `JoinCodeCard`: the code in a mono `bg-card` pill inside a `rounded-panel bg-muted/70` box with `CopyButton`; *Create code* / *Make a new code* (`confirm()`) / *Turn off*, then "Expires in …". Code rules in `lib/join-code.ts` (12 characters, `XXXX-XXXX-XXXX`) | `components/join-code-card.tsx` |
| Someone's role | `RoleMenu`: the `bg-muted` capitalised role chip. For the owner on anyone else's row it opens a `DropdownMenu`: "Role" radio items (label + muted hint, close on pick, optimistic) and a destructive "Remove from team" (`confirm()`) | `components/role-menu.tsx` |
| Loading a page | A `loading.tsx` per area, built from `components/page-skeleton.tsx`: `TableSkeleton` (data table pages: icon tile + title, the toolbar, the framed table and its foot), `PageSkeleton` (signed-in pages, `/r/[token]`: title and subtitle pills on `bg-card/70`, four `rounded-tile bg-card/60` tiles, a `rounded-sheet bg-card` sheet of `rounded-card bg-muted/60` rows), `FocusSkeleton` (focus pages: task, New task, Give feedback; the breadcrumb pill, the document card and the side panel in the page's own columns, `contents` adds the family outline column for `/tasks/[id]`; it carries `data-focus`), `DetailSkeleton` (the workspace's task sheet), `HeaderToolsSkeleton` (a `size-8 rounded-lg bg-muted` square for the bell and account row, no pulse). Skeletons fade in after 150ms (ease-out-expo) so fast navigations never flash them, pulse with shadcn `Skeleton`, and stop pulsing with reduced motion. `/workspace` shows the scene's own Hub poster ("Setting up your workspace") in the scene's place instead, so the hand-off is seamless; `/onboarding` shows the GetStarted shape on the auth page (`bg-card/70` bones, as on the canvas) | `components/page-skeleton.tsx`, `app/**/loading.tsx` |
| Feedback on someone's work | `FeedbackBoard` at `/projects/<id>/feedback` (task mode, after Tasks): a **data table page** (§4) of this project's points; the components read the project from the route (`useParams`) and `/api/feedback` takes `?project=`. Filter tabs For me / From me / Everyone (open counts) and Open / Fixed (`?who=`, `?fixed=1`, `?page=`), **Give feedback** in the head. Columns: round checkbox (marks it fixed, optimistic, toast "Marked as fixed" with Undo, since it leaves the Open list), the note's first line as plain text with a `size-9` screenshot thumbnail (the whole row opens the point), task (dot + title, or General), for, from, given, and a row menu (Edit / Delete point, `confirm()`) for the author, owners and admins. **A point's page** is the `/feedback/[id]` focus page (`FeedbackDetail`): Crumbs "Feedback › *note*", `PanelToggle` and the `h-11` pill "Mark as fixed" (dark) / "Reopen" (`secondary`), optimistic with the same Undo toast; the point as one `article` like the task page (a quiet facts line: from / for, task, Open or Fixed; a `h-px bg-foreground/5` rule; the note as a `Tuned` `RichText`, editable in place for whoever may delete (paste, drop or `/image` a screenshot into it via `uploadTo`, as the task description does) (saved on blur by `updateFeedback`, toast "Feedback updated"; read-only for others; row menu "Edit point" opens it); the screenshot at `max-h-72` in a `rounded-panel` `data-zoom` button that opens it in `ImageGallery` with the note's images); the side panel's Feedback fields (For, From, Task link or "No task", Status, Given) and, for whoever may delete, Actions › Delete point (`SideAction`, `confirm()`, back to the board). **Give feedback** is the `/feedback/new` focus page (`GiveFeedback`; `?task=` picks the task, from the task page's "Give feedback" button or ⌘K): the side panel's Feedback fields (For = a `Pick` of the team, or the task's assignee read-only once a task is picked; Task = an optional `Pick`, "No task" first, then the 100 most recently touched tasks), and one `RichText` page: each line or list item becomes a point, a heading goes with the point under it, and a screenshot pasted or dropped under a line belongs to that point (text after a screenshot starts the next one). Screenshots stay as local `blob:` URLs until Send; the page keeps what you wrote if you leave and come back (until a reload) and clears after a send. The submit pill reads "Send 3 points" so people see how the page splits, ⌘/Ctrl + Enter sends. Notes on the board render as Markdown (`RichText editable={false}`). Screenshots are shrunk in the browser (≤ 2000px wide, WebP, JPEG on Safari) and stored as attachments, served only to the workspace from `/api/attachments/[id]`. On a point's page, Actions › Add / Replace screenshot (file picker) and Remove screenshot (`confirm()`, only when there is a note to keep) edit it | `components/feedback.tsx`, `app/(app)/feedback`, `app/(app)/feedback/new`, `app/(app)/feedback/[id]` |
| Form page (every create and edit form) | `FormPage` + `FormCard` (`components/form-page.tsx`, on coss `field`): `PageHead`-style icon tile and `font-light` title with one muted line (no actions in the head), then one hairline card (`rounded-sheet border bg-card p-5 sm:p-6`, `max-w-3xl`, centred) of stacked `FormField`s: a `text-sm font-medium` label over a coss `Input size="lg"` / `Textarea` and a `text-xs` muted hint under it. Two short fields share a `FormRow` (`sm:grid-cols-2`). `FormError` is one `role="alert"` line; `FormActions` sits at the card's foot, left: the primary coss `Button` (names the result: "Create project", "Save changes") then a ghost Cancel. Create and Edit are the same component, edit pre-filled. Build every new form this way; dialogs stay only for tiny one-field asks. First user: `ProjectForm` (photo as the logo, name, description, colour) | `components/form-page.tsx`, `components/project-form.tsx` |
| Project row menu (Projects) | `ProjectMenu`: a `size-8` ⋯ trigger in the last cell: *Edit project* (links to `/projects/<id>/edit`) and *Archive project* (`archiveProject`, toast with Undo instead of `confirm()` since it is reversible) | `components/project-menu.tsx` |
| Archive (`/archive`) | `ArchiveTable`: a **data table page** of archived projects (mark, name, task count) with an outline *Restore* and, for owners and admins, a ⋯ menu with a destructive *Delete project* (`deleteProject`, `confirm()`, only works on archived projects; takes tasks, feedback and updates with it). `archivedTaskCounts()` in `lib/queries.ts`. No search or paging yet: add them when the list grows | `components/archive-table.tsx`, `app/(app)/(org)/archive` |
| Your API keys (Team, every member) | `AgentKeysCard`: each member sees and manages only their own keys (`listAgentKeys`, `createAgentKey`, `revokeAgentKey`). A pill name `Input` + dark *Create key* ("Creating…" while pending), one `role="alert"` error line under it. A new key shows once in a `rounded-panel bg-muted/70` box (height + fade in, 0.35s ease-out-expo, none with reduced motion): the key in a read-only mono `bg-card` pill with `CopyButton` "Copy key", "Copy it now. It won't be shown again.", a `rounded-row bg-card` mono `pre` of the `export WETRACK_URL=…` / `export WETRACK_API_KEY=…` lines (scrolls inside on phones) with "Copy setup", and *Done* to hide it. Live keys are `rounded-row bg-muted/60` rows (key icon, name, "Created · Last used / Not used yet · Expires" in `.tabular` muted `text-xs`, ghost *Revoke*) in a `popLayout` list (rise 8px on the `spring`, exit fade + 0.97 in 0.2s). At the limit (5) the form gives way to one muted line saying to revoke one. Revoke confirms in an `AlertDialog`. Empty: the empty-state box | `components/agent-keys-card.tsx` |
| Team name and leaving (Team) | `TeamSettings` card under Slack: owners and admins rename the team (`renameTeam`); everyone but the owner gets *Leave team* (`leaveTeam`, `confirm()`, then `/onboarding`) | `components/team-settings.tsx` |
| Primitive controls | `components/ui/*` (shadcn, Base UI) | `components/ui` |

Recurring one-offs to copy, not reinvent:
- **Header icon button**: `grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground`
  (the bell). On the page itself, the **round icon button** stays: `grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur hover:bg-card`.
- **Round checkbox**: `size-5`/`size-6` circle, `border-[1.5px] border-foreground/30`, filled `bg-foreground` with an SVG tick (see `TaskCard`).
- **Empty state**: `rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground`, with one sentence that says what to do next.
- **Properties panel** (a dialog, e.g. New meeting): `rounded-panel bg-muted/60 p-1.5`, `sm:grid-cols-2` rows of muted icon +
  label + ghost `Pick` whose hover fill is `bg-card` (see `Prop` in `meeting-form.tsx`).
- **Focus page** (task, New task, Give feedback, a feedback point): the page is the whole UI, like a document app. `data-focus` on its root
  marks it (the `focus-page:` variant is there for anything that should change; never a plain `:has([data-focus])`:
  Next keeps the page you left in the DOM under `display: none` for Back). The sidebar and header stay.
  Header row: `Crumbs` (`bits.tsx`: one glass `h-11` pill of a round Back button, then `trail` links and where you are,
  separated by `›`; below `sm` only Back and the nearest link) on the left: "Tasks › *parent* › *task*", "Tasks › New
  task", "Feedback › Give feedback". On the right: `PanelToggle` and the dark `h-11` submit pill (with a `⌘ ↵` hint from
  `sm`). Then a `FocusLayout`. New task is the task page itself (`TaskDetail` with `draft`): same document card, Info /
  Style panel and Sub-tasks, edits held locally (sub-tasks queued) until Add task; the quick-capture hint sits under the
  title, and Comments, Created and the feedback / meeting / delete actions only appear once it exists. Give feedback: the title as a borderless `text-4xl sm:text-5xl font-light`
  textarea (`overflow-hidden`; an `sr-only` `h1` where the crumb says it all), the fields in the side panel, the body as a
  `RichText` in an `EditorSheet`. Enter in the title moves to the body; ⌘/Ctrl + Enter submits. `loading.tsx` shows
  `FocusSkeleton` (every focus route has its own, never a list skeleton).
- **Task page** (a focus page, Craft-style): left, a **Contents** outline of the task's family (`h-9 rounded-row` links
  indented `1rem` per level, a status-coloured dot, hollow when not started; this task = `bg-card shadow-sm`), shown when
  it has a parent or children. Middle, the task as one document: an `article` (`rounded-tile bg-card px-5 py-6 sm:px-10
  sm:py-9 shadow-sm`) holding the title, a quiet `text-sm` facts line (project, status, priority unless normal, assignee,
  due), a `h-px bg-foreground/5` rule, the description (`Tuned` `RichText`), then **Sub-tasks** (`text-lg`, "1/2 done"):
  `rounded-row bg-muted/60` rows with a round checkbox, the title as a stretched link, children count, status, deadline
  and avatar, and a dashed "Add a sub-task and press Enter" field. Right, the tabbed panel: **Info** (Task fields,
  Actions as `SideAction` rows (`h-10 rounded-row`, `editor-tools.tsx`) — Add sub-task, Give feedback, Schedule meeting, a destructive Delete task with
  `confirm()` — Meetings when there are any, and "Created …"), **Style**, **Comments**.
- **Member multi-pick** (properties panel): ghost trigger listing first names ("Me, Dara, Sok", truncated), opening a
  `Popover` (`rounded-panel p-1.5 w-64`) of `h-10 rounded-row` rows: `UserAvatar` + name + `size-5` round checkbox on the
  right. Rows are `role="checkbox"` buttons with `aria-checked`; the popover stays open while you tick (see `NewMeetingDialog`).
- **Editor chrome** (Craft-style: the page is the UI, controls appear only when needed). Typing `/` at the start of a line
  or after a space opens the **block menu** at the caret: `rounded-panel bg-card p-1.5 shadow-lg` list of `h-10 rounded-row`
  rows (muted icon + label, active row `bg-muted`), filtered as you type, ↑/↓, Enter or Tab picks, Esc closes it without
  closing a dialog around it. An empty line shows "Type / for lists, checklists, images…" and a faint `size-7` round `+` at
  its right end that opens the same menu. Selecting text shows the **format bar** above it: floating glass pill
  (`bg-card/80 backdrop-blur shadow-lg`) of `size-8` round buttons (bold, italic, strike, code, link), pressed =
  `bg-foreground text-background`. Markdown shortcuts (`# `, `- `, `1. `, `[] `, `> `, ` ``` `) still work. Neither menu
  animates: they open from the keyboard many times a day. Buttons `preventDefault` on mousedown so the selection stays.
- **Tooltip**: shadcn `Tooltip` (Base UI) for icon-only controls; `rounded-full px-3 py-1.5`, a `kbd` inside gets
  `data-slot="kbd"` and `bg-background/15`. Compose the trigger with `render={<Link …/>}` or `render={<motion.button …/>}`.
- **Shortcut hint**: `kbd` chips `h-5 min-w-5 rounded-md bg-muted text-[11px]`, hidden below `sm`.
- **Data table page** (Tasks, Feedback, Meetings, Projects, Team; `components/data-table.tsx`, coss `table`, `card`, `empty`,
  `pagination`, `tabs` in `components/coss/`). Every list of records is this one template, never cards or grouped sheets:
  1. `PageHead`: a `size-10 rounded-lg border` icon tile tinted by `tone` (coss.com's product tiles: the hue at 10% behind, 25% on the edge, the icon in its `-foreground`; Tasks and Team `info`, Projects `warning`, Meetings `success`, Feedback `destructive`), the title (`font-light`)
     with its `.tabular` count, one muted line on what lives here, and the primary action (coss `Button`) at the right.
  2. `Toolbar`: `FilterTabs` (coss segmented tabs, a `TabCount` inside when a count helps) on the left; `ToolbarEnd`
     on the right holds `SearchField` (coss `InputGroup`, writes `?q=` 250ms after typing stops, `/` focuses, Esc clears)
     and `FilterPick`s. On phones `ToolbarEnd` takes its own row.
  3. `DataFrame` (coss `CardFrame`): a header band with the table's name and how many rows match, the white card with a
     coss `Table` (`min-w-3xl table-fixed`, so phones scroll the table, never the page; first and last cells `ps-5`/`pe-5`),
     and `DataPagination` in the foot ("Showing 26–50 of 132", Previous / numbered pages in 7 fixed slots / Next; one page
     says "4 rows"). Paging up from the foot scrolls the table's top back into view.
  4. Rows: the main cell's `Link` stretches over the row (`after:absolute after:inset-0`); controls in other cells are
     `relative z-10`. Inline edits are optimistic. Destructive actions sit in a row menu.
  5. Empty: `DataEmpty` on `bg-dots` (coss stacked icon tile, title, one line, one action). Filtered-empty says "No …
     match" and offers **Clear filters**; true empty says what will show up and how to add the first.
  6. State in the URL, changed with `setSearchParams` (History API, no navigation); any change but the page resets
     `?page=`. Server lists page in the database (`PAGE_SIZE` 25, `pageOffset()` in `lib/paging.ts`) through
     `useServerList` and an `/api/<list>` route that reads the same params; while the next page loads the current rows
     stay, dimmed (`pending`). `useClampPage` steps back when a page empties. `loading.tsx` is `TableSkeleton`.
  7. Sorting: sortable columns use `SortHead` (a button in the `th` with `aria-sort`; idle columns show a faint ↕ on
     hover, the sorted one ↑ or ↓). Click: ascending → descending → the table's own order. `?sort=` / `?dir=desc` in the URL,
     read by `readSort()`; server lists order in SQL (`by()` in `lib/queries.ts`, empty values last; a related row's value
     is a plain-SQL subquery, because relational queries rewrite orderBy columns onto the root table), client lists with
     `sortRows()`. Changing the sort goes back to page 1.
  8. Motion: none on rows when paging, sorting or filtering (it happens dozens of times a day); the page's `<Reveal>` only.
  Checklist for a new or changed list page: head with icon, count and action · tabs / search / pickers in the URL ·
  sortable columns ·
  framed table with a stretched row link · filtered-empty and true-empty states · pagination foot, page reset on filter,
  clamp on an emptied page · dimmed pending, `TableSkeleton` · 375px (table scrolls inside), light and dark.
- **Press feedback**: small pill and icon buttons get `active:scale-95` (cells and rows `active:scale-97`), with
  `transition-[background-color,scale]`.
- **Auth page** (`(auth)` layout, `AuthForm`, `GetStarted`; the layout of WeShop Seller's sign-in): no card. One centred
  `max-w-sm` column on the canvas, `pb-[25vh]` to clear the floor: the `Logo` (`text-4xl`, `mb-10`), then `AuthHeading`
  (centred `text-2xl font-light` + one muted line) and the form `gap-8` under it. The floor is Phnom Penh drawn across the
  bottom (`public/login/phnom-penh.webp`, `-night` in dark), a CSS background (only the current theme's image loads),
  `grayscale` and faded so it stays monochrome, masked at the top. `ThemeToggle` (round glass button, Sun / Moon, a "Theme
  `D`" tooltip) sits top right. Landing: the skyline rises 0.9s ease-out-expo, then the logo and the page `Reveal`. On the
  canvas the controls are white pills: `authField` (`h-11 rounded-full bg-card shadow-sm`, label `pl-4` muted) and
  `authButton` (`h-11 rounded-full`, `active:scale-97`). "Continue with Google" is a white pill above an "or with email"
  divider (`h-px flex-1 bg-foreground/10` on either side); Google's mark keeps its own colours: third-party brand marks
  are the one exception to "no raw hex". A pending button shows the shadcn `Spinner` and says what it's doing ("Sending
  code…", "Signing in…"); only the button that was pressed changes. Email sign-in is two steps: email + "Send code", then
  "Check your email" (naming the address and the 5-minute expiry), six separate `size-12 rounded-row bg-card` `InputOTP`
  slots that sign in on the sixth digit, the "Sign in" button, and "Use another email" / "Resend code" as muted link
  buttons. Going on slides the new step in 24px from the right, going back from the left (0.35s ease-out-expo, opacity
  only with reduced motion). Resend waits 30s ("Resend in 24s", `.tabular`) and is free again at once when the code
  expired; a failed resend is a `toast.error`. A wrong code clears the slots, shakes them once (none with reduced motion),
  keeps focus there (`readOnly` while checking, never `disabled`) and shows the one-line error. Coming back from Google
  (back/forward cache) resets the pending button.
- **Stretched link card**: title `<Link>` with `after:absolute after:inset-0`. Inner interactive elements get `relative z-10`.

---

## 5. Interaction patterns

- **Inline edit**: selects save on change, text saves on blur, dates save on change. Errors go to a
  `toast.error`. Success is silent unless it's a create or delete. Exception: a block dragged in the 3D
  workspace pulses while it saves, then a toast says what moved ("Moved to Review", "Assigned to Dara")
  with an **Undo** action, because the change happens far from any list.
- **Optimistic toggles** (`useOptimistic`) for checkboxes and sub-tasks. The server result reconciles.
- **Shortcuts**: **C** new task, **⌘/Ctrl + K** command menu, **/** focuses task search, **Esc** clears it.
  Single-key shortcuts ignore key presses in fields (`isTyping` in `lib/utils.ts`).
- **Tasks views**: `?view=table|cards|date|priority` (table is the default, so it's left out of the URL; old `board` and
  `calendar` links open the table) and `?status=open|active|done|all` (all is the default), sorted by `?sort=` and paged by
  `?page=`. Every view shows the same page of rows: Cards as `TaskGrid`, Date grouped by `groupByDate()`, Priority as
  `TaskPriorityTable`, with the same pagination under them. Old `?view=<status>`, `?view=mine` and `?layout=board` links
  still work.
- **Create** a task or feedback on a **document page**, not a dialog: `/projects/<id>/tasks/new` (`TaskDetail draft`, the
  task page before it exists) and `/projects/<id>/feedback/new`. **C**, the sidebar's New task, ⌘K and panels fire
  `NEW_TASK_EVENT`; `NewTaskHost` opens `newTaskHref(projectId, preset)` (`…/tasks/new?status=…&priority=…&assigneeId=…`) in
  the preset's project or the one you're in (see §3). After adding, the new task's page replaces the form. In the
  workspace it opens in a drawer (`@panel/(..)projects/[projectId]/tasks/new`). A project is created on its own **form page**, `/create` (`ProjectForm`, see Form page), and edited on `/projects/<id>/edit`. Meetings stay in a dialog.
- **Destructive actions**: in a `DropdownMenu` (`variant="destructive"`), confirmed with `confirm()`. New work confirms with the
  shadcn `AlertDialog` instead (`components/ui/alert-dialog.tsx`, on Animate UI like `dialog`): `rounded-tile bg-card`, a
  `text-lg` question naming the thing ("Revoke *Work laptop*?"), one line on what happens, then `h-10 rounded-full` *Cancel*
  and a `variant="destructive"` pill naming the action ("Revoke key", "Revoking…" while pending; Esc and Cancel are locked
  while it runs). Keep the subject in state until the dialog has animated out, so its title doesn't blank.
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
- `CalendarDayButton` must pass its `ref` to `Button` (fixed locally; the base-nova registry copy creates the ref
  but never attaches it, so arrow-key focus is lost). Keep `ref={ref}` if you re-add or update `calendar`.
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
- [ ] Navigation/header icons come from animate-ui (`@animate-ui/icons-*`); check the registry before using lucide there.
- [ ] Only tokens: no `rounded-[…]`, no raw hex, semantic colour from `lib/labels.ts`.
- [ ] Surfaces follow §3 (canvas → sheet → card).
- [ ] Motion uses `spring` / `Reveal` / ease-out-expo, and lists animate add and remove. A new page gets a
      `loading.tsx` skeleton, and no `<ViewTransition>`.
- [ ] Works at 375px, in dark mode, with keyboard only and with reduced motion.
- [ ] Submit buttons have `type="submit"`. Icon buttons have labels.
- [ ] Checked in the browser (light, dark, phone width).
