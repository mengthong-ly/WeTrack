"use client"

import {
  ArchiveRestoreIcon,
  BoxIcon,
  CircleHelpIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { archiveProject, restoreProject, updateProject, updateTask } from "@/app/actions"
import { HealthBadge, ProjectDot, UserAvatar } from "@/components/bits"
import { NEW_TASK_EVENT, type NewTaskPreset } from "@/components/command-menu"
import { CountUp, ProgressBar } from "@/components/motion-bits"
import { NewProject } from "@/components/new-project"
import { PillTabs } from "@/components/pill-tabs"
import { ProjectScene, type SceneMove, type ScenePick } from "@/components/project-scene"
import { ShareLinkCard } from "@/components/share-link-card"
import { TaskList, type TaskCardData } from "@/components/task-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { TaskStatus } from "@/lib/db/enums"
import { HEALTH, PROJECT_COLORS, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { MemberLite } from "@/lib/options"
import type { SceneData, SceneMember, SceneProject } from "@/lib/scene"
import { cn, isTyping } from "@/lib/utils"

/**
 * The 3D workspace: the scene fills the screen and is where work is managed.
 * Click the core, a project, a status station or a person for a side panel (edit, add, archive);
 * click a task block for the full task in a sheet (the @panel route). Drag a block onto another
 * status, or unassigned work onto a person. A "+" on any label starts a task there.
 */

export type WorkspaceCard = TaskCardData & { projectId: string; assigneeId: string | null }
type Share = { active: { createdAt: string; lastViewed: string | null } | null } | null
type Archived = { id: string; name: string; color: string }[]
type Filter = "all" | "mine" | "attention"

const INTRO = "wetrack:workspace-intro" // the legend opens once, the first time
const STATUS_ORDER = ["not_started", "in_progress", "review", "blocked", "completed"] as const
const round =
  "relative grid size-11 shrink-0 place-items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur transition-[background-color,scale] hover:bg-card active:scale-95"

const sheet =
  "gap-0 bg-card p-0 data-[side=right]:w-full data-[side=right]:border-l-0 sm:rounded-l-tile data-[side=right]:sm:max-w-md"
const pill =
  "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm transition-[background-color,color,scale] active:scale-95"
const empty = "rounded-card bg-muted/60 px-5 py-6 text-sm text-muted-foreground"

const newTask = (preset: NewTaskPreset) => window.dispatchEvent(new CustomEvent(NEW_TASK_EVENT, { detail: preset }))

export function Workspace({
  scene,
  cards,
  members,
  unreported,
  share,
  meId,
  attention,
  archived,
}: {
  scene: SceneData
  cards: WorkspaceCard[]
  members: MemberLite[]
  unreported: Record<string, number>
  share: Share
  meId: string
  /** Task ids that need attention: overdue, blocked, stale or unowned (needsAttention). */
  attention: string[]
  archived: Archived
}) {
  const router = useRouter()
  const [, start] = useTransition()
  // `panel` outlives `open`, so the sheet keeps its content while it slides out.
  const [panel, setPanel] = useState<ScenePick | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [outline, setOutline] = useState(false)
  const [focus, setFocus] = useState<{ pick: ScenePick; n: number } | null>(null)
  const search = useRef<HTMLInputElement>(null)

  const fly = useCallback((pick: ScenePick) => setFocus((f) => ({ pick, n: (f?.n ?? 0) + 1 })), [])
  const openPanel = useCallback(
    (p: ScenePick) => {
      if (p.kind === "task") return router.push(`/tasks/${p.id}`, { scroll: false })
      setPanel(p)
      setOpen(true)
    },
    [router]
  )
  // From the Outline: fly the camera there and open the same panel a click in 3D would.
  const reach = (p: ScenePick) => {
    fly(p)
    openPanel(p)
  }

  // Saved like an inline edit, but a drag happens far from any list: say what moved, offer Undo.
  const onMove = useCallback(
    (id: string, patch: SceneMove) => {
      const card = cards.find((c) => c.id === id)
      start(async () => {
        const res = await updateTask(id, patch)
        if (res.error) {
          toast.error(res.error)
          router.refresh()
          return
        }
        const back: Parameters<typeof updateTask>[1] = patch.status ? { status: card?.status } : { assigneeId: card?.assigneeId ?? null }
        const who = patch.assigneeId && members.find((m) => m.id === patch.assigneeId)?.name.split(" ")[0]
        toast(patch.status ? `Moved to ${STATUS[patch.status].label}` : `Assigned to ${who ?? "them"}`, {
          description: card?.title,
          action: {
            label: "Undo",
            onClick: async () => {
              const undo = await updateTask(id, back)
              if (undo.error) toast.error(undo.error)
            },
          },
        })
      })
    },
    [cards, members, router]
  )
  const onAdd = useCallback((preset: NewTaskPreset) => {
    setOpen(false)
    newTask(preset)
  }, [])
  const close = () => setOpen(false)

  // "/" jumps to the search, as on the Tasks page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || isTyping(e.target) || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      setOutline(true)
      requestAnimationFrame(() => search.current?.focus())
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // What search and the filter keep lit; the scene dims the rest.
  const need = useMemo(() => new Set(attention), [attention])
  const q = query.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!q && filter === "all") return null
    return cards.filter(
      (c) =>
        (filter === "all" ||
          (filter === "mine" ? c.assigneeId === meId && c.status !== "completed" : need.has(c.id))) &&
        (!q || c.title.toLowerCase().includes(q) || c.project.name.toLowerCase().includes(q) || !!c.assignee?.name.toLowerCase().includes(q))
    )
  }, [cards, q, filter, meId, need])
  const highlight = useMemo(() => {
    if (!matches) return null
    const keys = new Set<string>()
    for (const c of matches) {
      keys.add(`task:${c.id}`)
      keys.add(`project:${c.projectId}`)
      if (c.assigneeId) keys.add(`member:${c.assigneeId}`)
    }
    if (q) {
      for (const p of scene.projects) if (p.name.toLowerCase().includes(q)) keys.add(`project:${p.id}`)
      for (const m of scene.members) if (m.name.toLowerCase().includes(q)) keys.add(`member:${m.id}`)
    }
    return keys
  }, [matches, q, scene])

  const project = panel?.kind === "project" ? scene.projects.find((p) => p.id === panel.id) : undefined
  const member = panel?.kind === "member" ? scene.members.find((m) => m.id === panel.id) : undefined

  return (
    <>
      <h1 className="sr-only">Workspace</h1>
      {/* Fills the screen under the header; the header and the dock sit above it. */}
      <div className="fixed inset-x-0 top-20 bottom-0 sm:top-24 lg:left-24">
        <ProjectScene
          data={scene}
          chrome="page"
          surface="background"
          calm
          onPick={openPanel}
          onMove={onMove}
          focusOn={focus}
          highlight={highlight}
          className="size-full"
          toolbar={
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Outline"
                aria-pressed={outline}
                onClick={() => setOutline((o) => !o)}
                className={round}
              >
                <PanelLeftIcon className="size-5" />
                {highlight && <span className="absolute top-2 right-2 size-2 rounded-full bg-orange-500 ring-2 ring-card" aria-hidden />}
              </button>
              <Legend />
            </div>
          }
          empty={
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">No projects yet. Start one, then add its first task.</p>
              <NewProject variant="button" />
            </div>
          }
        />
        <Outline
          className={cn(!outline && "hidden")}
          search={search}
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          matches={matches}
          scene={scene}
          members={members}
          onReach={reach}
          onTask={(id) => {
            fly({ kind: "task", id })
            openPanel({ kind: "task", id })
          }}
          onClose={() => setOutline(false)}
        />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className={sheet}>
          {panel?.kind === "workspace" && (
            <WorkspacePanel scene={scene} share={share} archived={archived} onNewTask={() => onAdd({})} />
          )}
          {project && (
            <ProjectPanel
              key={project.id}
              project={project}
              cards={cards.filter((c) => c.projectId === project.id && c.status !== "completed")}
              unreported={unreported[project.id] ?? 0}
              onNewTask={() => onAdd({ projectId: project.id })}
              onClose={close}
            />
          )}
          {panel?.kind === "status" && (
            <StatusPanel
              status={panel.id as TaskStatus}
              count={scene.counts[panel.id as TaskStatus]}
              cards={cards.filter((c) => c.status === panel.id)}
              onNewTask={() => onAdd({ status: panel.id as TaskStatus })}
              onClose={close}
            />
          )}
          {member && (
            <MemberPanel
              member={member}
              user={members.find((m) => m.id === member.id)}
              cards={cards.filter((c) => c.assigneeId === member.id && c.status !== "completed")}
              onNewTask={() => onAdd({ assigneeId: member.id })}
              onClose={close}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

const row =
  "flex h-10 w-full min-w-0 items-center gap-2.5 rounded-row px-3 text-left text-sm transition-[background-color,scale] hover:bg-muted active:scale-97"

// The scene as a list: every project, status and person, and search across all tasks. The way in
// for keyboards and screen readers, and the fastest way to find one thing among many.
function Outline({
  className,
  search,
  query,
  setQuery,
  filter,
  setFilter,
  matches,
  scene,
  members,
  onReach,
  onTask,
  onClose,
}: {
  className?: string
  search: React.RefObject<HTMLInputElement | null>
  query: string
  setQuery: (q: string) => void
  filter: Filter
  setFilter: (f: Filter) => void
  matches: WorkspaceCard[] | null
  scene: SceneData
  members: MemberLite[]
  onReach: (p: ScenePick) => void
  onTask: (id: string) => void
  onClose: () => void
}) {
  return (
    <nav
      aria-label="Outline"
      className={cn(
        "absolute top-16 bottom-40 left-3 z-10 flex w-[calc(100%-1.5rem)] flex-col rounded-panel bg-card/90 shadow-lg ring-1 ring-foreground/5 backdrop-blur sm:top-[4.5rem] sm:bottom-44 sm:left-4 sm:w-72",
        className
      )}
    >
      <div className="flex items-center gap-2 p-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && query && (e.stopPropagation(), setQuery(""))}
            placeholder="Search the workspace"
            aria-label="Search the workspace"
            className="h-10 rounded-full bg-muted/60 pr-9 pl-9 dark:bg-muted/60 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("")
                search.current?.focus()
              }}
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-[background-color,scale] hover:bg-card active:scale-95"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
          {!query && (
            <kbd className="pointer-events-none absolute top-1/2 right-3 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-md bg-card px-1 text-[11px] max-sm:hidden">
              /
            </kbd>
          )}
        </div>
        <button type="button" aria-label="Close outline" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,scale] hover:bg-muted active:scale-95 lg:hidden">
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="px-2 pb-2">
        <PillTabs
          id="workspace-filter"
          className="bg-muted/60 ring-0 backdrop-blur-none"
          items={(
            [
              ["all", "All"],
              ["mine", "Mine"],
              ["attention", "Needs attention"],
            ] as const
          ).map(([key, label]) => ({ key, label, active: filter === key, onSelect: () => setFilter(key) }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {matches ? (
          <section aria-label="Matching tasks">
            <h2 className="flex items-baseline justify-between px-3 pt-2 pb-1 text-xs text-muted-foreground">
              Tasks <span className="tabular">{matches.length}</span>
            </h2>
            {matches.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {query ? `Nothing matches “${query.trim()}”.` : filter === "mine" ? "Nothing open is yours. Drag unassigned work onto your station." : "Nothing needs attention. Nice."}
              </p>
            )}
            <ul>
              {matches.slice(0, 40).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onTask(c.id)} className={cn(row, "h-auto py-2")}>
                    <ProjectDot color={c.project.color} className="mt-1.5 self-start" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className={STATUS[c.status].className}>{STATUS[c.status].label}</span>
                        {c.health === "overdue" || c.health === "due_soon" ? (
                          <span className={HEALTH[c.health].className}> · {HEALTH[c.health].label}</span>
                        ) : null}
                        {c.assignee && ` · ${c.assignee.name.split(" ")[0]}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {matches.length > 40 && <p className="px-3 py-2 text-xs text-muted-foreground">Showing 40 of {matches.length}. Narrow the search to see the rest.</p>}
          </section>
        ) : (
          <>
            {/* The core's panel: New project, the CEO link, archived projects. */}
            <button type="button" onClick={() => onReach({ kind: "workspace", id: "workspace" })} className={cn(row, "mt-1")}>
              <BoxIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Workspace</span>
              <span className="text-xs text-muted-foreground">Projects, sharing</span>
            </button>
            <Group title="Projects" count={scene.projects.length}>
              {scene.projects.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onReach({ kind: "project", id: p.id })} className={row}>
                    <ProjectDot color={p.color} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className={cn("size-1.5 shrink-0 rounded-full", PROJECT_HEALTH[p.health].dot)} aria-label={PROJECT_HEALTH[p.health].label} />
                    <span className="tabular w-6 text-right text-xs text-muted-foreground">{p.open}</span>
                  </button>
                </li>
              ))}
            </Group>
            <Group title="Statuses">
              {STATUS_ORDER.map((st) => (
                <li key={st}>
                  <button type="button" onClick={() => onReach({ kind: "status", id: st })} className={row}>
                    <span className={cn("size-2 shrink-0 rounded-full bg-current", STATUS[st].className)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{STATUS[st].label}</span>
                    <span className="tabular w-6 text-right text-xs text-muted-foreground">{scene.counts[st]}</span>
                  </button>
                </li>
              ))}
            </Group>
            <Group title="People" count={scene.members.length}>
              {scene.members.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onReach({ kind: "member", id: m.id })} className={row}>
                    <UserAvatar user={members.find((u) => u.id === m.id) ?? { name: m.name, image: null }} className="size-6 ring-0" />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.overdue > 0 && <span className={cn("text-xs", HEALTH.overdue.className)}>{m.overdue} late</span>}
                    <span className="tabular w-6 text-right text-xs text-muted-foreground">{m.open}</span>
                  </button>
                </li>
              ))}
            </Group>
          </>
        )}
      </div>
    </nav>
  )
}

function Group({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="pt-2">
      <h2 className="flex items-baseline justify-between px-3 pb-1 text-xs text-muted-foreground">
        {title}
        {count !== undefined && <span className="tabular">{count}</span>}
      </h2>
      <ul>{children}</ul>
    </section>
  )
}

// What the views, colours and gestures mean. Opens by itself once; "?" brings it back.
function Legend() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      if (!localStorage.getItem(INTRO)) {
        localStorage.setItem(INTRO, "1")
        const t = setTimeout(() => setOpen(true), 900) // after the scene has drawn
        return () => clearTimeout(t)
      }
    } catch {}
  }, [])
  const swatch = (className: string) => <span className={cn("size-2.5 shrink-0 rounded-full bg-current", className)} aria-hidden />
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="How the workspace works" className={round}>
        <CircleHelpIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-4 rounded-panel p-5">
        <PopoverTitle className="text-base font-normal">How the workspace works</PopoverTitle>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt>Hub</dt>
          <dd className="text-muted-foreground">Your projects around the workspace.</dd>
          <dt>Flow</dt>
          <dd className="text-muted-foreground">Every task, standing on its status.</dd>
          <dt>Team</dt>
          <dd className="text-muted-foreground">Who has what, and work nobody owns yet.</dd>
        </dl>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            {swatch(PROJECT_HEALTH.on_track.className)}
            {swatch(PROJECT_HEALTH.at_risk.className)}
            {swatch(PROJECT_HEALTH.off_track.className)}
            <span>Project strip: on track, at risk, behind</span>
          </li>
          <li className="flex items-center gap-2.5">
            {swatch(STATUS.in_progress.className)}
            {swatch(STATUS.review.className)}
            {swatch(STATUS.completed.className)}
            <span>Block colour is its status</span>
          </li>
          <li className="flex items-center gap-2.5">
            {swatch(HEALTH.overdue.className)}
            {swatch(HEALTH.due_soon.className)}
            <span>Band at the foot: overdue, due soon</span>
          </li>
          <li className="flex items-center gap-2.5">
            {swatch(HEALTH.overdue.className)}
            <span>Pin on top: urgent. Red strip under a person: overdue work</span>
          </li>
        </ul>
        <ul className="flex flex-col gap-1 text-sm">
          <li>Drag to move around. Shift-drag, right-drag or the turn buttons to turn. Scroll or pinch to zoom.</li>
          <li>Click anything to open it.</li>
          <li>Drag a block onto another status, or unassigned work onto a person.</li>
          <li>
            Press <kbd className="rounded-md bg-muted px-1.5 text-[11px]">/</kbd> to search. Overview brings you back.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={cn(pill, "self-start bg-foreground text-background")}
        >
          Got it
        </button>
      </PopoverContent>
    </Popover>
  )
}

// A task opened from the scene: the full task (TaskDetail) in a wide sheet. Closing goes back.
// The sheet opens at once; its children stream in and bring their own (sr-only) SheetTitle.
export function TaskSheet({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  // Next keeps a closed sheet's page alive (hidden): reset it as it hides, so coming back to the
  // same task opens it again.
  useLayoutEffect(() => () => setOpen(true), [])
  return (
    <Sheet open={open} onOpenChange={setOpen} onOpenChangeComplete={(o) => !o && router.back()}>
      <SheetContent showCloseButton={false} className={cn(sheet, "data-[side=right]:sm:max-w-xl")}>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

function NewTaskButton({ onClick, children = "New task" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(pill, "bg-foreground text-background")}>
      <PlusIcon className="size-4" />
      {children}
    </button>
  )
}

// Opening a task from a list closes the panel; the task's own sheet takes over.
function Tasks({ cards, onClose, none }: { cards: WorkspaceCard[]; onClose: () => void; none: string }) {
  return (
    <div className="flex-1 overflow-y-auto px-3 pb-6 sm:px-4" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && onClose()}>
      <TaskList tasks={cards} empty={<p className={empty}>{none}</p>} />
    </div>
  )
}

function WorkspacePanel({
  scene,
  share,
  archived,
  onNewTask,
}: {
  scene: SceneData
  share: Share
  archived: Archived
  onNewTask: () => void
}) {
  const [, start] = useTransition()
  const open = Object.values(scene.counts).reduce((a, b) => a + b, 0) - scene.counts.completed
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <SheetTitle className="pr-8 text-2xl font-light tracking-tight">Workspace</SheetTitle>
        <SheetDescription className="tabular">
          {scene.projects.length} projects · {open} open · {scene.members.length} people
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          <NewTaskButton onClick={onNewTask} />
          <NewProject variant="button" />
          <Link href="/tasks" className={cn(pill, "bg-muted hover:bg-foreground hover:text-background")}>
            All tasks
          </Link>
        </div>
        {share && (
          <section>
            <h2 className="mb-2 text-lg">CEO link</h2>
            <ShareLinkCard active={share.active} />
          </section>
        )}
        {archived.length > 0 && (
          <section>
            <h2 className="mb-1 text-lg">Archived projects</h2>
            <p className="mb-3 text-sm text-muted-foreground">Out of every list, tasks and all. Restore one to bring it back.</p>
            <ul className="flex flex-col gap-2">
              {archived.map((p) => (
                <li key={p.id} className="flex h-12 items-center gap-2.5 rounded-row bg-muted/60 pr-2 pl-4 text-sm">
                  <ProjectDot color={p.color} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        const res = await restoreProject(p.id)
                        if (res.error) toast.error(res.error)
                        else toast.success(`${p.name} restored`)
                      })
                    }
                    className={cn(pill, "h-8 bg-card px-3 text-xs hover:bg-foreground hover:text-background")}
                  >
                    <ArchiveRestoreIcon className="size-3.5" />
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}

function ProjectPanel({
  project,
  cards,
  unreported,
  onNewTask,
  onClose,
}: {
  project: SceneProject
  cards: WorkspaceCard[]
  unreported: number
  onNewTask: () => void
  onClose: () => void
}) {
  const [, start] = useTransition()
  const [color, setColor] = useState(project.color)
  const save = (patch: { name?: string; color?: string }) =>
    start(async () => {
      const res = await updateProject(project.id, patch)
      if (res.error) toast.error(res.error)
    })

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <SheetTitle className="sr-only">{project.name}</SheetTitle>
        <div className="flex items-center gap-2 pr-8">
          <ProjectDot color={color} className="size-3" />
          {/* Edit in place: saves on blur or Enter. */}
          <form
            className="min-w-0 flex-1"
            action={(form) => {
              const name = String(form.get("name") ?? "").trim()
              if (name && name !== project.name) save({ name })
            }}
          >
            <Input
              name="name"
              defaultValue={project.name}
              aria-label="Project name"
              maxLength={60}
              onBlur={(e) => e.currentTarget.form?.requestSubmit()}
              className="-mx-2 h-11 rounded-row border-0 bg-transparent px-2 text-2xl font-light tracking-tight shadow-none hover:bg-muted/60 md:text-2xl dark:bg-transparent"
            />
          </form>
        </div>
        <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <HealthBadge health={project.health} />
          <span className="tabular">{project.open} open</span>
          <span className="tabular">{project.total - project.open} done</span>
          {project.overdue > 0 && <span className={cn("tabular", HEALTH.overdue.className)}>{project.overdue} overdue</span>}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-6 pb-5">
        <div>
          <span className="text-5xl font-light tracking-tight">
            <CountUp value={project.progress} suffix="%" />
          </span>
          <ProgressBar value={project.progress} className="mt-3" />
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Colour</legend>
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              aria-pressed={c === color}
              onClick={() => {
                setColor(c)
                save({ color: c })
              }}
              className={cn("size-7 rounded-full ring-offset-2 ring-offset-card transition-[scale] active:scale-90", c === color && "ring-2 ring-foreground")}
              style={{ background: c }}
            />
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <NewTaskButton onClick={onNewTask} />
          <Link href={`/projects/${project.id}/updates`} className={cn(pill, "bg-muted hover:bg-foreground hover:text-background")}>
            <MessageSquareTextIcon className="size-4" />
            {unreported ? `${unreported} to tell the client` : "Client updates"}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className="grid size-10 place-items-center rounded-full bg-muted transition-[background-color,scale] hover:bg-muted/70 active:scale-95"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm(`Archive “${project.name}”? It and its tasks leave every list until you restore it from the workspace panel.`)) return
                    const res = await archiveProject(project.id)
                    if (res.error) return toast.error(res.error)
                    toast.success("Project archived")
                    onClose()
                  }}
                >
                  <Trash2Icon />
                  Archive project
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <h2 className="px-6 pb-3 text-lg">Open tasks</h2>
      <Tasks cards={cards} onClose={onClose} none="Nothing open here. Press + to add a task." />
    </>
  )
}

function StatusPanel({
  status,
  count,
  cards,
  onNewTask,
  onClose,
}: {
  status: TaskStatus
  count: number
  cards: WorkspaceCard[]
  onNewTask: () => void
  onClose: () => void
}) {
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <SheetTitle className={cn("pr-8 text-2xl font-light tracking-tight", STATUS[status].className)}>{STATUS[status].label}</SheetTitle>
        <SheetDescription className="tabular">{count} tasks. Drag a block onto another station to move it.</SheetDescription>
      </SheetHeader>
      <div className="px-6 pb-5">
        <NewTaskButton onClick={onNewTask} />
      </div>
      <Tasks cards={cards} onClose={onClose} none="Nothing here right now." />
    </>
  )
}

function MemberPanel({
  member,
  user,
  cards,
  onNewTask,
  onClose,
}: {
  member: SceneMember
  user?: MemberLite
  cards: WorkspaceCard[]
  onNewTask: () => void
  onClose: () => void
}) {
  const first = member.name.split(" ")[0]
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 pr-8">
          <UserAvatar user={user ?? { name: member.name, image: null }} className="size-10" />
          <SheetTitle className="min-w-0 truncate text-2xl font-light tracking-tight">{member.name}</SheetTitle>
        </div>
        <SheetDescription className="flex flex-wrap gap-x-3">
          <span className="tabular">{member.open} open</span>
          <span className={cn("tabular", member.active && STATUS.in_progress.className)}>{member.active} in progress</span>
          {member.overdue > 0 && <span className={cn("tabular", HEALTH.overdue.className)}>{member.overdue} overdue</span>}
        </SheetDescription>
      </SheetHeader>
      <div className="px-6 pb-5">
        <NewTaskButton onClick={onNewTask}>New task for {first}</NewTaskButton>
      </div>
      <Tasks cards={cards} onClose={onClose} none={`${first} has nothing open. Drag unassigned work onto their station.`} />
    </>
  )
}
