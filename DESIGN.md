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
   no separate "edit" screens. The one exception is the 3D workspace, where a thing's drawer is a calm
   summary and every change opens as a **nested drawer** on top (see `Layer` in §4).

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

Project colours come from `PROJECT_COLORS` in `lib/labels.ts` and appear only as a small dot (`ProjectDot`). A project with a
logo shows it instead where the project is the subject (project card, 3D token) via `ProjectMark`; lists keep the dot.

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

- Page shell: **full width**, `px-4 sm:px-8 pt-6 sm:pt-8 pb-40 lg:pb-12 lg:pl-28` (the left padding clears the rail
  from lg; focus pages drop it to `pl-8`). The bottom padding clears the dock, which only shows below lg.
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
| Page change | leaving page 150ms fade + 6px lift, arriving page 250ms fade, ease-out-expo (`PageTransition`) | Every route change. |

Rules: animate only `opacity`, `transform`, `width` (progress) and layout. Lists that change use
`<AnimatePresence mode="popLayout">` + `layout`. Always respect reduced motion (`useReducedMotion`,
as `CountUp` does). Never delay an action's result behind an animation.

**Page transitions** are React `<ViewTransition>`s (CSS at the end of `globals.css`). Every `page.tsx` wraps its root in
`PageTransition` and every `loading.tsx` in `PageTransition enter="none"` (skeletons fade themselves in after a beat, and a
short transition lets fast pages land sooner); the workspace is `enter="none"` too, so its poster hands over in place. Only
the page content moves: the root stays live, the search/account buttons and rail stay put (and fade with the page when a focus page hides
or shows them), and the dock, toasts and Base UI popups are pinned above the fading page. One cross-fade everywhere, no
directional slides: most moves here are lateral. Back/Forward swap instantly (React commits history moves synchronously).
Reduced motion keeps the fades and drops the lift. Fixed chrome with hover popups calls `useHoldHoverInTransitions` (rail,
dock): while a transition starts, the browser sends the hovered link a mouseleave, Base UI closes its tooltip with
`flushSync`, and React skips the transition. A floating layer that isn't Base UI or Sonner needs adding to the pinned list.

**Pages render as a static shell plus streamed data** (Cache Components + Partial Prefetching). The
layout's frame (rail, dock, tool shapes) and each area's `loading.tsx` are prefetched with every link,
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

**There is no app header.** No logo bar: search (`SearchButton`, a round glass icon button firing `SEARCH_EVENT`; ⌘K
still works) and the account menu (`UserMenu`) are `size-11 bg-card/85` glass circles stacked by the "+": under it in
the rail from `lg`, above it in the dock below that. Every page opens straight on its `h1`.

**Home is a daily summary, nothing more**, built like every other page (`flex flex-col gap-6`, `h1` + muted line, then
a sheet): the greeting as the `h1`, then one muted line with the date and facts about *your* tasks (in progress · due this week, then overdue / blocked in their
`lib/labels.ts` colours only when non-zero), and one "Continue" sheet: your in-progress tasks, then up next, 7 at most,
with an "All tasks" link. No stat tiles, 3D scene, meetings, activity or project lists here; those live on their own pages.

From **lg**, navigation is the **rail** (`SideRail`, `components/app-sidebar.tsx`): the dock stood on its end, floating at
the left and centred vertically (`fixed left-4 top-1/2`). A glass pill (`rounded-full bg-card/85 p-1.5 shadow-lg
backdrop-blur-xl ring-1 ring-foreground/5`) of the six links as `size-11` round icons (active = `bg-muted` pill moving with
`layoutId` and `spring`), names in `side="right"` tooltips, and the dark `size-13` "+" FAB under it ("New task", `C`).
Nothing else lives there: no labels, no projects. Search and the account menu are the only other frame pieces (see §3). The 3D
workspace starts right of the rail (`lg:left-24`).

Below lg, the **dock** (floating pill nav and dark round "+" FAB) is fixed at the bottom on every signed-in page. Its six
links (Home, Workspace, Tasks, Projects, Feedback, Team) are icons only on phones (`px-3`, `gap-0.5`, so they fit at
375px); the active one shows its label from `sm`. Every link keeps an `sr-only` label and has a shadcn `Tooltip` with
its name (`side="top"`, `sideOffset={10}`, `rounded-full`, trigger `delay={400}`, then neighbours open instantly);
the active link's tooltip is `disabled` since its label is on screen. The FAB's tooltip reads "New task" with a `C` kbd.
Read-only pages (`/r/[token]`) have no dock and show a "Read-only" pill in the header.

---

## 4. Components: reuse before you build

| Need | Use | File |
|---|---|---|
| Number with label + corner meta | `StatTile` | `components/stat-tile.tsx` |
| A task in a list | `TaskCard` / `TaskList` (`readOnly` for public pages) | `components/task-card.tsx` |
| Tasks as documents (the default Tasks view) | `TaskGrid`: an auto-fill grid (`minmax(16rem,1fr)`, `gap-4`) of `h-80 rounded-tile bg-card p-5 shadow-sm` page-shaped cards that open the task: title (`text-lg`, two lines), a `h-px bg-foreground/5` rule, a thumbnail of the description drawn small by `MiniDoc` (headings, lists, round checklist dots, quotes, code, images; marks dropped) fading out at the foot (`mask-b-from-60%`), then project dot + name, `StatusText`, sub-tasks done/total, deadline (health colour when due soon or late) and avatar. Hover `shadow-md`, press `scale-99`; cards enter and leave like `TaskList`. Only top-level tasks; the server passes the first 1200 characters of the description as `body` | `components/task-grid.tsx` |
| Sub-tasks | A sub-task is a **full task** with `parent_id` (any depth; deleting a task deletes everything under it). It takes its parent's project; `addSubtask(parentId, title)` is the quick add, ticking is `updateTask` (completed / not started). Task lists, the grid and the board show top-level tasks and count the children; workload, attention and the 3D workspace count every task. `placeInTree()` (`lib/task-tree.ts`) gives a task its ancestors and its family from the root | `lib/task-tree.ts`, `app/actions.ts` |
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
| Per-person load (in progress, due 7d, overdue, done this week) | `Workload` + `workload()`; columns are fixed widths so separate row grids line up | `components/workload.tsx` |
| Tasks by status, drag to move | `TaskBoard` (native drag and drop + a "Move to" menu for keyboard and touch; cards use `layoutId`) | `components/task-board.tsx` |
| Dense tasks table by priority | `TaskTable` (collapsible groups, inline status and priority selects, "Add task" row prefills priority) | `components/task-table.tsx` |
| Month calendar + day sheet | `TaskCalendar`: shadcn `Calendar` (controlled `month`, `onDayClick`, `hideNavigation`) with a `DayButton` built on `CalendarDayButton`; chips on the deadline day; a day opens a `Sheet` with a `TaskList` | `components/task-calendar.tsx` |
| Side panel over the page | `Sheet` (shadcn, Base UI dialog), `bg-card`, `sm:rounded-l-tile`, `sm:max-w-md` | `components/ui/sheet.tsx` |
| Workspace drawers (nested) | `Layer` on the shadcn `Drawer` (Base UI): a right `rounded-l-tile` card from `sm`, a bottom `rounded-t-tile` sheet with a swipe handle below it; one width (`32rem`) for every drawer so the one behind always peeks out. A `Layer` rendered inside another nests: the one behind shrinks and steps back (shadcn's stack), Esc and swipe close the front one first. Uncontrolled with `trigger`, or `open` / `onOpenChange`. `LayerHead` (optional `size-11` mark, `text-2xl font-light` title, a muted facts line, round Close), `LayerBody` (the one scroll area, `px-6 pb-6`), `Rows` + `Row` (a `rounded-panel bg-muted/60 p-1` group of `h-12 rounded-row` rows: muted icon, label, meta, chevron when it opens a drawer). Routed drawers (`RouteDrawer`: a task, New task, Client updates) live in the `@panel` slot, outside the workspace's tree, so the workspace drawer under one gets `behind` and stacks the same way and ignores close until the front one goes | `components/workspace-drawer.tsx` |
| Tasks page params, date groups, month paging | `readParams()`, `groupByDate()`, `addMonths()` | `lib/task-views.ts` |
| Jump anywhere / run an action | `CommandMenu` (⌘K, or `SearchButton` in the rail and dock) | `components/command-menu.tsx` |
| Fields typed into a title | `parseCapture()` (`#project @person due fri !urgent`), shown as "Picked up" chips | `lib/quick-capture.ts` |
| Project marker | `ProjectDot`; `ProjectMark` shows the logo (round, `object-contain`, `bg-card ring-1 ring-foreground/5`, sized by `className`, `size-8` on project cards) or falls back to the dot | `components/bits.tsx` |
| Progress | `ProgressBar` (animated) | `components/motion-bits.tsx` |
| Animated number | `CountUp` | `components/motion-bits.tsx` |
| Section entrance | `Reveal index={n}` | `components/motion-bits.tsx` |
| Page enter / leave on navigation | `PageTransition` around a page's root (`enter="none"` in `loading.tsx`), see §2 Motion | `components/motion-bits.tsx` |
| Image preview | `ImageGallery` wraps a page (task, feedback point, Give feedback): images in Markdown (`.rich img`, kept to `max-h-72` with `cursor-zoom-in`) and anything marked `data-zoom` open on click in a `rounded-tile` dialog (`sm:max-w-5xl`, image `max-h-[75dvh] object-contain`). With more than one image in the page: round prev / next buttons, `size-12 rounded-row` thumbnails (current = `ring-2 ring-foreground`), "2 / 5" from `sm`, ←/→ keys. Switching images doesn't animate | `components/image-gallery.tsx` |
| Copy-to-clipboard | `CopyButton` | `components/share-link-card.tsx` |
| Connect Google Calendar | `ConnectGoogle` (outline button) or `connectGoogle()` for a menu item; account menu shows "Google Calendar connected" as a label once linked, nothing when Google isn't configured | `components/connect-google.tsx` |
| Slack webhook setting (Team, owners and admins) | `SlackCard`: pill input + Connect; once linked, "Posting to Slack" with Replace and Remove (`confirm()`). Takes only `connected`, the URL never reaches the client. Error is one `role="alert"` line under the field | `components/slack-card.tsx` |
| Schedule a Google Meet | `NewMeetingDialog` (mounted once in the app layout with `members`, `meId`, `calendarConnected`, `googleEnabled`) opened by `openNewMeeting({ title?, taskId? })` from ⌘K, task detail ("Schedule meeting" round button) and Home. Date is a single-mode `Calendar` in a `Popover`, Start/End are ghost `Input type="time" step={300}` (next half hour, 30 min; moving the start keeps the length). Under the title, an optional borderless auto-growing `Textarea` description (muted until focused, 2000 chars, also sent to Google). With Slack connected, the footer has a "Post to Slack" `role="checkbox"` pill (round checkbox + label, on by default) before the submit pill; the post is a Block Kit card (`slackMeetingCard` in `lib/meetings.ts`). Not connected: one line + `ConnectGoogle`; Google not configured: one muted line, no form | `components/new-meeting-dialog.tsx` |
| Meeting within the hour | `MeetingBanner` (floating glass `rounded-tile` strip above the page: video icon, "*Title* starts in 45 min" or "is on now", "+N more", dark `h-10` Join pill opening in a new tab). Server passes ISO dates; a 30-second client clock re-checks `bannerState()`, renders nothing on the server or outside the window. Rises 12px ease-out-expo, opacity only with reduced motion | `components/meeting-banner.tsx` |
| Upcoming meetings | `MeetingList` (Home "Meetings" sheet after Continue: your meetings in the next 7 days, with `NewMeetingButton`, only when there are any; task detail "Meetings" above the tabs in a `rounded-panel bg-card p-2` panel when there are any, `readOnly` on the CEO page). Rows `rounded-row bg-muted/60`: `.tabular` slot, title, member avatars + task link, `bg-card` Join pill (only for invitees, the creator, owners and admins via `canJoin()` in `lib/meetings.ts`; the CEO page shows it on every row), row menu "Send to Slack" (reposts the card; toast "Sent to Slack", or the error when Slack isn't connected) and "Cancel meeting" (`destructive`, `confirm()`, optimistic; leaves with the list exit). The list is an `@container`: narrow (Home column) puts Join and the menu on the avatars line, `@md` and up moves them to the right of the row. Rows come from `meetingItems()` in `lib/queries.ts`, which formats the slot in `APP_TIMEZONE` and sets `canCancel` on the server | `components/meeting-list.tsx` |
| 3D workspace overview | `ProjectScene` (three.js) draws the workspace as **hairline tokens** on a paper floor. A token is a rounded square (an extruded shape, corners `0.15 × size`, a small bevel) seen in perspective: its **mark engraved on top**, its name in a badge under the mark, and fine vertical hairlines down its sides. The mark is an image as a duotone between the face's two colours (`workspace.logo`, a person's `image`; uploaded images will use the same path), initials (`initials()`, Geist 400) until there is one, or a status glyph (dashed ring, half, three-quarter, cross, filled check). Faces carry faint scanlines like an engraving. Every colour comes from the theme or `lib/labels.ts`, read at mount and repainted when the theme changes, so light and dark both work; nothing is a fixed hex except a project's own colour. The floor is 1px hairline grid lines that fade out before an edge, with soft shadows. Nothing sits along the top: one bar at the bottom holds `PillTabs` for Hub / Flow / Team, round recentre, turn left / right (`sm+`) and play/pause buttons, then the page's own `toolbar` (or a glass "Live / Paused · N open" pill, `sm+`). Below `sm` the views take their own row above the buttons. The selected-item and journey cards sit top-left; the gesture hint top-right (`lg`). Hub: the workspace token at the core (ink, mark in paper colour), a token per project in the project's colour (taller with more open work, white or near-black engraving by contrast) joined to the core by a 1px ink hairline (outer ring arcs over the inner one); hovering a token lifts it and darkens its line. Flow: a paper tray per status with its glyph at the front edge and blocks stacked behind it, a hairline belt carrying the followed task with a "Following one task" card (step + progress); Focus with nothing picked follows it. Team: a person's token (paper face, ink sides) raised on a stack of slabs, one per open task (in progress / blocked in status colours), plus an Unassigned tray. Meaning sits on a thin plate under each token (project health, status, red for someone with overdue work) that glows on hover. Names are engraved on the token: a pill badge under the mark (the ink at 14% behind `font-medium` text, cut with an ellipsis), beside the glyph on a tray. Lines are 1px hairlines in the ink colour only (opacity 0.3), never a project or status colour. Task blocks carry their facts: a band at the foot when overdue (red) or due soon (amber), a pin on top when urgent, and the deadline in the tooltip; with `highlight` set, blocks that don't match fade toward the paper, tokens go see-through and labels dim. **Hover**: each item has one invisible hit box (its bounds, extended down by how far it rises, so a lifted token never slips from under the pointer); only those boxes are raycast, and only when the pointer or camera moved. The hovered item alone lifts (ease rate 10, no neighbour motion), its plate glows, and the tooltip glides between items instead of jumping. Hover shows a glass tooltip; click focuses the camera and opens a `rounded-panel` glass card with Open (`linked` only). **Moving around** is map-style (`MapControls`): drag moves along the floor, Shift-drag or right-drag turns (and two round turn buttons beside play, `sm+`, spin the view 45° with an eased turn), wheel or pinch zooms toward the pointer, a sideways two-finger swipe (or Shift + wheel) moves left and right; on touch one finger moves, two turn and zoom. The point you look at is clamped to the current view, and Overview re-centres. Gestures act on the scene, not the page. hairline's `Hub` (`components/ui/hub.tsx`, `@lucasmarkes/hairline`) is the loading poster, the no-WebGL fallback (with Reload) and the empty state. Data from `sceneData()` in `lib/scene.ts`; sign-in uses `SAMPLE_SCENE`. Reduced motion starts paused (play still works) and skips easing | `components/project-scene.tsx` |
| 3D workspace (manage work in 3D) | `Workspace` at `/workspace` (dock: Workspace, after Home). `ProjectScene` with `chrome="page"` fills the screen (`fixed`; the tools and banner sit above it), bottom controls sit above the dock. Click the core, a project, a status station or a person for its drawer (`Layer`). Each is a calm summary; changes stack on top as nested drawers. **Project**: mark (logo or colour dot on a grey disc), name, health and counts; the big progress %; New task, Edit and a ⋯ menu (Archive project); `Rows` for People (avatar stack) and Client updates (unreported count); the open tasks. *Edit project* (nested): name and `PROJECT_COLORS` swatches saved together by Save (`updateProject`), and a Logo row opening *Logo* (third level: `size-32` preview, Upload / Replace image, Remove; shrunk to 512px, shown at once while it saves). *People* (nested): who has open work here (open, in progress, overdue) and the unassigned count. *Archive* (nested, replaces `confirm()`): Archive project / Cancel, then the project drawer closes. **Core**: New task, New project, All tasks, and `Rows` for CEO link (owners/admins, `ShareLinkCard`) and Archived projects (Restore), each nested. **Status** and **person** drawers list their tasks with a preset New task. A task block, or a task in any drawer, opens the full `TaskDetail` in a `RouteDrawer` through the `@panel/(..)tasks/[id]` intercepting route, stacked over the open drawer; `/tasks/<id>` opened directly is still the page. Client updates opens the same way (`@panel/(..)projects/[id]/updates`, data from `loadClientUpdates()`), and `/projects/<id>/updates` is still the page. Drag a Flow block onto another status station, or an Unassigned block (Team) onto a person: saved with `updateTask`, silent on success, `toast.error` + refresh on failure. New task with the project, status or person filled in starts from its panel (`NEW_TASK_EVENT` detail is a `NewTaskPreset`) and opens the New task page in a `RouteDrawer` over the drawer it came from (`@panel/(..)tasks/new`), which becomes the new task's drawer once added; the scene itself has no floating labels or "+" buttons. Edits refresh the data and the scene rebuilds in place, keeping mode, camera and selection. **Outline** (`nav`, glass `rounded-panel`, `w-72`, closed by default, an overlay with a close button below `lg`; toggled by a round `PanelLeftIcon` button that shows an orange dot while a search or filter is on): a search field (`/` focuses it, Esc clears, own clear button, native cancel hidden), `PillTabs` filters All / Mine / Needs attention (`needsAttention()` ids), and every project, status and person as `h-10 rounded-row` rows that fly the camera there and open the same panel, so keyboards and screen readers reach everything. With a search or filter on, it lists matching tasks (40 max) and the scene dims the rest (`highlight`). **Legend**: round `CircleHelpIcon` button, a `Popover` explaining the three views, the colours and the gestures; it opens by itself once (`wetrack:workspace-intro` in localStorage). The outline toggle and the Legend sit at the end of the scene's bottom bar (the Legend opens upward). The scene runs `calm` here: no Live pill, journey card or hint line, and motion stops at the first touch (Play brings it back). **Archived projects** are listed in the core panel with Restore (`restoreProject`); `listTasks` leaves out archived projects' tasks everywhere | `components/workspace.tsx`, `app/(app)/workspace` |
| Signed in with no team | `GetStarted` on `/onboarding` (auth card): `PillTabs` "Join a team" / "Create a team" on `bg-muted`, one form each (`h-12` input, hint line, `h-10` submit), "Signed in as … Sign out" footer. The join code input is mono, centred, uppercases and adds the dash as you type | `components/get-started.tsx` |
| Join code (Team, owners and admins) | `JoinCodeCard`: the code in a mono `bg-card` pill inside a `rounded-panel bg-muted/70` box with `CopyButton`; *Create code* / *Make a new code* (`confirm()`) / *Turn off*, then "Expires in …". Code rules in `lib/join-code.ts` (12 characters, `XXXX-XXXX-XXXX`) | `components/join-code-card.tsx` |
| Someone's role | `RoleMenu`: the `bg-muted` capitalised role chip. For the owner on anyone else's row it opens a `DropdownMenu`: "Role" radio items (label + muted hint, close on pick, optimistic) and a destructive "Remove from team" (`confirm()`) | `components/role-menu.tsx` |
| Loading a page | A `loading.tsx` per area, built from `components/page-skeleton.tsx`: `PageSkeleton` (signed-in pages, `/r/[token]`: title and subtitle pills on `bg-card/70`, four `rounded-tile bg-card/60` tiles, a `rounded-sheet bg-card` sheet of `rounded-card bg-muted/60` rows), `FocusSkeleton` (focus pages: task, New task, Give feedback; the breadcrumb pill, the document card and the side panel in the page's own columns, `contents` adds the family outline column for `/tasks/[id]`; it carries `data-focus`, so the tools and rail stay hidden while a task or sub-task loads), `DetailSkeleton` (the workspace's task sheet), `HeaderToolsSkeleton` (the search and account circles, no pulse). Skeletons fade in after 150ms (ease-out-expo) so fast navigations never flash them, pulse with shadcn `Skeleton`, and stop pulsing with reduced motion. `/workspace` shows the scene's own Hub poster ("Setting up your workspace") in the scene's place instead, so the hand-off is seamless; `/onboarding` shows the GetStarted shape inside the auth card | `components/page-skeleton.tsx`, `app/**/loading.tsx` |
| Feedback on someone's work | `FeedbackBoard` at `/feedback` (dock: Feedback, before Team). `PillTabs` For me / From me / Everyone (open counts, `.tabular`) and Open / Fixed, plus a dark "Give feedback" pill. One `rounded-sheet` holds a section per task (`ProjectDot` + task link + "For *name*" avatar), newest first, each point a `rounded-row bg-muted/60` row: round checkbox (as `TaskCard`) marks it fixed (optimistic; toast "Marked as fixed" with Undo, since it leaves the Open list), the note, the screenshot as a `h-44 sm:h-56 object-cover object-top rounded-xl` button that opens a `rounded-tile` lightbox dialog, then author + time. Row menu "Delete point" (`destructive`, `confirm()`) for the author, owners and admins. A task is optional: points without one group under **General** by who they're for. The **whole row** opens the point's page (a stretched `data-row-link` Link like `TaskCard`; checkbox, screenshot and menu sit above it at `z-10`): `hover:bg-muted`, a faint `active:scale-[0.99]` press, a chevron that slides in on hover (`sm+`). **A point's page** is the `/feedback/[id]` focus page (`FeedbackDetail`): Crumbs "Feedback › *note*", `PanelToggle` and the `h-11` pill "Mark as fixed" (dark) / "Reopen" (`secondary`), optimistic with the same Undo toast; the point as one `article` like the task page (a quiet facts line: from / for, task, Open or Fixed; a `h-px bg-foreground/5` rule; the note as a `Tuned` `RichText`, editable in place for whoever may delete (paste, drop or `/image` a screenshot into it via `uploadTo`, as the task description does) (saved on blur by `updateFeedback`, toast "Feedback updated"; read-only for others; row menu "Edit point" opens it); the screenshot at `max-h-72` in a `rounded-panel` `data-zoom` button that opens it in `ImageGallery` with the note's images); the side panel's Feedback fields (For, From, Task link or "No task", Status, Given) and, for whoever may delete, Actions › Delete point (`SideAction`, `confirm()`, back to the board). **Give feedback** is the `/feedback/new` focus page (`GiveFeedback`; `?task=` picks the task, from the task page's "Give feedback" button or ⌘K): the side panel's Feedback fields (For = a `Pick` of the team, or the task's assignee read-only once a task is picked; Task = an optional `Pick`, "No task" first, then the 100 most recently touched tasks), and one `RichText` page: each line or list item becomes a point, a heading goes with the point under it, and a screenshot pasted or dropped under a line belongs to that point (text after a screenshot starts the next one). Screenshots stay as local `blob:` URLs until Send; the page keeps what you wrote if you leave and come back (until a reload) and clears after a send. The submit pill reads "Send 3 points" so people see how the page splits, ⌘/Ctrl + Enter sends. Notes on the board render as Markdown (`RichText editable={false}`). Screenshots are shrunk in the browser (≤ 2000px wide, WebP, JPEG on Safari) and stored as attachments, served only to the workspace from `/api/attachments/[id]`. On a point's page, Actions › Add / Replace screenshot (file picker) and Remove screenshot (`confirm()`, only when there is a note to keep) edit it | `components/feedback.tsx`, `app/(app)/feedback`, `app/(app)/feedback/new`, `app/(app)/feedback/[id]` |
| Primitive controls | `components/ui/*` (shadcn, Base UI) | `components/ui` |

Recurring one-offs to copy, not reinvent:
- **Round icon button**: `grid size-11 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur hover:bg-card`.
- **Round checkbox**: `size-5`/`size-6` circle, `border-[1.5px] border-foreground/30`, filled `bg-foreground` with an SVG tick (see `TaskCard`).
- **Empty state**: `rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground`, with one sentence that says what to do next.
- **Properties panel** (a dialog, e.g. New meeting): `rounded-panel bg-muted/60 p-1.5`, `sm:grid-cols-2` rows of muted icon +
  label + ghost `Pick` whose hover fill is `bg-card` (see `Prop` in `meeting-form.tsx`).
- **Focus page** (task, New task, Give feedback, a feedback point): the page is the whole UI, like a document app. `data-focus` on its root
  hides the search/account buttons and rail (CSS in `globals.css`, and the `focus-page:` variant for anything else that changes;
  never a plain `:has([data-focus])`: Next keeps the page you left in the DOM under `display: none` for Back, and its
  marker would hide the chrome on the next page; the dock stays on phones; the workspace sheet leaves it off).
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
- **Table rows** (inside a sheet): `h-11` cells, `border-t border-foreground/5` hairlines (the one place lines are
  allowed: rows on one surface, never between surfaces), opaque `bg-card` with `group-hover:bg-muted` so the pinned
  first column stays solid. Fixed column widths, title takes the rest, `min-w-4xl` and `overflow-x-auto` on the sheet
  so phones scroll the table, never the page. Group header: chevron + `PriorityChip` + muted count. Status and priority
  cells are ghost `Pick`s (coloured dot / flag labels, `hover:bg-card` on the hovered row, cell `px-1`), saved
  optimistically with `useOptimistic`; a new priority moves the row to its group.
- **Calendar cell**: `rounded-row bg-muted/50` (outside the month `bg-muted/20`), date in a `size-6` circle (today
  `bg-foreground text-background`, past days muted). `sm+`: up to 3 `bg-card` pill chips with a `ProjectDot`, then
  "+N more". Phones: dots only. The month slides 16px in from the side you moved to (0.3s ease-out-expo, via
  `useAnimate` on a wrapper so the grid never remounts); keyboard paging doesn't animate. Custom `Calendar`
  slots (`DayButton` etc.) must be stable module-level components that read data from context, never inline
  functions, or every cell remounts and keyboard focus is lost.
- **Press feedback**: small pill and icon buttons get `active:scale-95` (cells and rows `active:scale-97`), with
  `transition-[background-color,scale]`.
- **Auth card** (`AuthForm`, `GetStarted`): `(auth)` layout card, `h-10` controls. "Continue with Google" is an
  `outline` button above an "or with email" divider (`h-px flex-1 bg-foreground/10` on either side). Google's mark keeps
  its own colours: third-party brand marks are the one exception to "no raw hex". Email sign-in is two steps in one
  card (0.2s fade between them): email + "Send code", then "Check your email" (heading + one muted line naming the
  address), six joined `size-12` `InputOTP` slots (`components/ui/input-otp.tsx`) that sign in on the sixth digit, the
  `h-10` "Sign in" button, and "Use another email" / "Resend code" as muted link buttons. A wrong code clears the slots,
  keeps focus there (`readOnly` while checking, never `disabled`) and shows the one-line error.
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
- **Tasks views**: `?view=cards|date|priority|board|calendar` (cards is the default, so it's left out of the URL) and
  `?status=open|active|done|all` (all is the default). Old `?view=<status>`, `?view=mine` and `?layout=board` links
  still work. Search, person and project filters apply to every view.
- **Board columns**: `rounded-tile bg-card/60` (the stat tile surface) holding white `rounded-card` cards with `shadow-sm`.
  The drop target gets `ring-2 ring-foreground/15`. Empty column: dashed `border-foreground/10` box with one line of help.
- **Create** a task or feedback on a **document page**, not a dialog: `/tasks/new` (`TaskDetail draft`, the task page before it
  exists) and `/feedback/new`. **C**, the dock's "+", ⌘K and panels fire `NEW_TASK_EVENT`; `NewTaskHost` opens
  `newTaskHref(preset)` (`/tasks/new?status=…&priority=…&projectId=…&assigneeId=…`). The project defaults to the last one
  used (cookie set by `createTask`). After adding, the new task's page replaces the form. In the workspace, `/tasks/new`
  opens in a drawer (`@panel/(..)tasks/new`). Smaller creates (project, meeting) stay in dialogs.
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
- [ ] Only tokens: no `rounded-[…]`, no raw hex, semantic colour from `lib/labels.ts`.
- [ ] Surfaces follow §3 (canvas → sheet → card).
- [ ] Motion uses `spring` / `Reveal` / ease-out-expo, and lists animate add and remove. A new page (and its
      `loading.tsx`) is wrapped in `PageTransition`.
- [ ] Works at 375px, in dark mode, with keyboard only and with reduced motion.
- [ ] Submit buttons have `type="submit"`. Icon buttons have labels.
- [ ] Checked in the browser (light, dark, phone width).
