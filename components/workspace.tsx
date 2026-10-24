"use client"

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BoxIcon,
  CircleHelpIcon,
  ImageIcon,
  ImageOffIcon,
  ImagePlusIcon,
  Link2Icon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { archiveProject, restoreProject, setProjectLogo, updateProject, updateTask } from "@/app/actions"
import { HealthBadge, ProjectDot, UserAvatar } from "@/components/bits"
import { NEW_TASK_EVENT, type NewTaskPreset } from "@/components/command-menu"
import { CountUp, ProgressBar } from "@/components/motion-bits"
import { NewProject } from "@/components/new-project"
import { PillTabs } from "@/components/pill-tabs"
import { ProjectScene, type SceneMove, type ScenePick } from "@/components/project-scene"
import { ShareLinkCard } from "@/components/share-link-card"
import { Layer, LayerBody, LayerHead, Row, Rows } from "@/components/workspace-drawer"
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
import type { TaskStatus } from "@/lib/db/enums"
import { imageForm, shrink } from "@/lib/image"
import { HEALTH, PROJECT_COLORS, PROJECT_HEALTH, STATUS } from "@/lib/labels"
import type { MemberLite } from "@/lib/options"
import type { SceneData, SceneMember, SceneProject } from "@/lib/scene"
import { cn, isTyping } from "@/lib/utils"

/**
 * The 3D workspace: the scene fills the screen and is where work is managed.
 * Click the core, a project, a status station or a person for its drawer; edits, logo, people, archive
 * and the rest open as drawers nested on top. A task block (or a task in any drawer) opens the full
 * task in a drawer of its own (the @panel route), stacked over whatever is open. Drag a block onto another
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
  // A routed drawer (task, New task, Client updates) is open over the workspace.
  const routed = usePathname() !== "/workspace"
  const [, start] = useTransition()
  // `panel` outlives `open`, so the drawer keeps its content while it slides out.
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
  // New task opens over the drawer it came from (the @panel route), so the drawer stays.
  const onAdd = useCallback((preset: NewTaskPreset) => newTask(preset), [])
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

      <Layer open={open} onOpenChange={setOpen} behind={open && routed}>
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
            />
          )}
          {member && (
            <MemberPanel
              member={member}
              user={members.find((m) => m.id === member.id)}
              cards={cards.filter((c) => c.assigneeId === member.id && c.status !== "completed")}
              onNewTask={() => onAdd({ assigneeId: member.id })}
            />
          )}
      </Layer>
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
        "absolute top-3 bottom-56 left-3 z-10 flex w-[calc(100%-1.5rem)] flex-col rounded-panel bg-card/90 shadow-lg ring-1 ring-foreground/5 backdrop-blur sm:top-4 sm:bottom-44 sm:left-4 sm:w-72",
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
      <PopoverContent side="top" align="end" sideOffset={8} className="w-80 gap-4 rounded-panel p-5">
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
            Press <kbd className="rounded-md bg-muted px-1.5 text-[11px]">/</kbd> to search. The recentre button brings you back.
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

function NewTaskButton({ onClick, children = "New task" }: { onClick: () => void; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn(pill, "self-start bg-foreground text-background")}>
      <PlusIcon className="size-4" />
      {children}
    </button>
  )
}

// A task in any drawer opens on top of it (the @panel route), so the drawer stays put behind.
function Tasks({ title, cards, none }: { title: string; cards: WorkspaceCard[]; none: string }) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 text-lg">
        {title}
        <span className="tabular text-sm text-muted-foreground">{cards.length}</span>
      </h2>
      <TaskList tasks={cards} empty={<p className={empty}>{none}</p>} />
    </section>
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
  const open = Object.values(scene.counts).reduce((a, b) => a + b, 0) - scene.counts.completed
  return (
    <>
      <LayerHead
        title="Workspace"
        description={
          <span className="tabular">
            {scene.projects.length} projects · {open} open · {scene.members.length} people
          </span>
        }
      />
      <LayerBody className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <NewTaskButton onClick={onNewTask} />
          <NewProject variant="button" />
          <Link href="/tasks" className={cn(pill, "bg-muted hover:bg-foreground hover:text-background")}>
            All tasks
          </Link>
        </div>
        <Rows>
          {share && (
            <Layer trigger={<Row icon={Link2Icon} meta={share.active ? "On" : "Off"}>CEO link</Row>}>
              <LayerHead title="CEO link" />
              <LayerBody>
                <ShareLinkCard active={share.active} />
              </LayerBody>
            </Layer>
          )}
          <Layer trigger={<Row icon={ArchiveIcon} meta={<span className="tabular">{archived.length || "None"}</span>}>Archived projects</Row>}>
            <ArchivedProjects archived={archived} />
          </Layer>
        </Rows>
      </LayerBody>
    </>
  )
}

function ArchivedProjects({ archived }: { archived: Archived }) {
  const [, start] = useTransition()
  return (
    <>
      <LayerHead title="Archived projects" description="Out of every list, tasks and all. Restore one to bring it back." />
      <LayerBody>
        {archived.length === 0 ? (
          <p className={empty}>Nothing archived. Archive a project from its ⋯ menu.</p>
        ) : (
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
        )}
      </LayerBody>
    </>
  )
}

// The project's mark in a drawer header: its logo, or its colour dot on a grey disc.
function Mark({ color, logo, className }: { color: string; logo: string | null; className?: string }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- private, cookie-guarded image; next/image can't fetch it
    <img src={logo} alt="" className={cn("size-11 shrink-0 rounded-full bg-card object-contain ring-1 ring-foreground/5", className)} />
  ) : (
    <span className={cn("grid size-11 shrink-0 place-items-center rounded-full bg-muted", className)}>
      <ProjectDot color={color} className="size-3" />
    </span>
  )
}

// A project at a glance; everything that changes it opens in a drawer on top.
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
  const router = useRouter()
  const [archiving, setArchiving] = useState(false)
  // The logo shows at once (a blob: URL) while it uploads; a failure puts the old one back.
  const [logo, setLogo] = useState(project.logo)
  const [uploading, startUpload] = useTransition()
  const saveLogo = (file: File | null) =>
    startUpload(async () => {
      const image = file && (await shrink(file, 512))
      setLogo(image && URL.createObjectURL(image))
      const res = await setProjectLogo(project.id, image ? imageForm("logo", image) : new FormData())
      if (res.error) {
        toast.error(res.error)
        setLogo(project.logo)
      }
    })
  const people = useMemo(() => {
    const by = new Map<string, Person>()
    let unassigned = 0
    for (const c of cards) {
      if (!c.assigneeId || !c.assignee) {
        unassigned++
        continue
      }
      const p = by.get(c.assigneeId) ?? { id: c.assigneeId, user: c.assignee, open: 0, active: 0, overdue: 0 }
      p.open++
      if (c.status === "in_progress") p.active++
      if (c.health === "overdue") p.overdue++
      by.set(c.assigneeId, p)
    }
    return { list: [...by.values()].sort((a, b) => b.open - a.open), unassigned }
  }, [cards])

  return (
    <>
      <LayerHead
        mark={<Mark color={project.color} logo={logo} />}
        title={project.name}
        description={
          <>
            <HealthBadge health={project.health} />
            <span className="tabular">{project.open} open</span>
            <span className="tabular">{project.total - project.open} done</span>
            {project.overdue > 0 && <span className={cn("tabular", HEALTH.overdue.className)}>{project.overdue} overdue</span>}
          </>
        }
      />
      <LayerBody className="flex flex-col gap-6">
        <div>
          <span className="text-5xl font-light tracking-tight">
            <CountUp value={project.progress} suffix="%" />
          </span>
          <ProgressBar value={project.progress} className="mt-3" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewTaskButton onClick={onNewTask} />
          <EditProject
            project={project}
            logo={logo}
            uploading={uploading}
            onLogo={saveLogo}
            trigger={
              <button type="button" className={cn(pill, "bg-muted hover:bg-foreground hover:text-background")}>
                <PencilIcon className="size-4" />
                Edit
              </button>
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="More actions"
              className="grid size-10 place-items-center rounded-full bg-muted transition-[background-color,scale] hover:bg-muted/70 active:scale-95"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => setArchiving(true)}>
                  <ArchiveIcon />
                  Archive project
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Rows>
          <Layer
            trigger={
              <Row
                icon={UsersIcon}
                meta={
                  people.list.length > 0 ? (
                    <span className="flex">
                      {people.list.slice(0, 3).map((p) => (
                        <UserAvatar key={p.id} user={p.user} className="-ml-1.5 size-6 ring-2 ring-muted first:ml-0" />
                      ))}
                    </span>
                  ) : (
                    "Nobody yet"
                  )
                }
              >
                People
              </Row>
            }
          >
            <ProjectPeople name={project.name} people={people.list} unassigned={people.unassigned} />
          </Layer>
          <Row
            icon={MessageSquareTextIcon}
            meta={unreported > 0 && <span className="tabular">{unreported} to tell</span>}
            onClick={() => router.push(`/projects/${project.id}/updates`, { scroll: false })}
          >
            Client updates
          </Row>
        </Rows>
        <Tasks title="Open tasks" cards={cards} none="Nothing open here. Press New task to add one." />
      </LayerBody>
      <ArchiveProject project={project} open={archiving} onOpenChange={setArchiving} onArchived={onClose} />
    </>
  )
}

type Person = { id: string; user: { name: string; image: string | null }; open: number; active: number; overdue: number }

function ProjectPeople({ name, people, unassigned }: { name: string; people: Person[]; unassigned: number }) {
  return (
    <>
      <LayerHead title="People" description={`Who has open work on ${name}`} />
      <LayerBody>
        {people.length === 0 && unassigned === 0 ? (
          <p className={empty}>Nobody has open work here yet. Assign a task to see them.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((p) => (
              <li key={p.id} className="flex h-14 items-center gap-3 rounded-row bg-muted/60 px-3 text-sm">
                <UserAvatar user={p.user} className="size-8" />
                <span className="min-w-0 flex-1 truncate">{p.user.name}</span>
                <span className="tabular flex shrink-0 gap-2 text-xs text-muted-foreground">
                  <span>{p.open} open</span>
                  {p.active > 0 && <span className={STATUS.in_progress.className}>{p.active} in progress</span>}
                  {p.overdue > 0 && <span className={HEALTH.overdue.className}>{p.overdue} overdue</span>}
                </span>
              </li>
            ))}
            {unassigned > 0 && (
              <li className="flex h-14 items-center gap-3 rounded-row px-3 text-sm text-muted-foreground">
                <span className="grid size-8 place-items-center rounded-full border-[1.5px] border-dashed border-foreground/20">
                  <UserIcon className="size-3.5" />
                </span>
                <span className="flex-1">Unassigned</span>
                <span className="tabular text-xs">{unassigned} open</span>
              </li>
            )}
          </ul>
        )}
      </LayerBody>
    </>
  )
}

// Name and colour, saved together; the logo has its own drawer on top.
function EditProject({
  project,
  logo,
  uploading,
  onLogo,
  trigger,
}: {
  project: SceneProject
  logo: string | null
  uploading: boolean
  onLogo: (file: File | null) => void
  trigger: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [color, setColor] = useState(project.color)
  const [error, setError] = useState<string>()
  const [pending, start] = useTransition()
  return (
    <Layer trigger={trigger} open={open} onOpenChange={setOpen}>
      <LayerHead title="Edit project" />
      <LayerBody>
        <form
          className="flex flex-col gap-6"
          action={(form) =>
            start(async () => {
              const name = String(form.get("name") ?? "").trim()
              const res = await updateProject(project.id, { name, color })
              if (res.error) return setError(res.error)
              setError(undefined)
              setOpen(false)
            })
          }
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Name</span>
            <Input name="name" defaultValue={project.name} required maxLength={60} className="h-12 rounded-full bg-muted/60 px-4 text-base" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm text-muted-foreground">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={c === color}
                  onClick={() => setColor(c)}
                  className={cn("size-8 rounded-full ring-offset-2 ring-offset-card transition-[scale] active:scale-90", c === color && "ring-2 ring-foreground")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          <Rows>
            <Layer
              trigger={
                <Row icon={ImageIcon} meta={logo ? <Mark color={color} logo={logo} className="size-7" /> : "None"}>
                  Logo
                </Row>
              }
            >
              <ProjectLogo color={color} logo={logo} uploading={uploading} onLogo={onLogo} />
            </Layer>
          </Rows>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className={cn(pill, "self-start bg-foreground px-5 text-background disabled:opacity-60")}>
            {pending ? "Saving" : "Save"}
          </button>
        </form>
      </LayerBody>
    </Layer>
  )
}

function ProjectLogo({
  color,
  logo,
  uploading,
  onLogo,
}: {
  color: string
  logo: string | null
  uploading: boolean
  onLogo: (file: File | null) => void
}) {
  return (
    <>
      <LayerHead title="Logo" description="Shown on the project's token and card instead of its dot." />
      <LayerBody className="flex flex-col items-center gap-6 pt-4">
        <Mark color={color} logo={logo} className={cn("size-32 transition-opacity", uploading && "opacity-60")} />
        <div className="flex flex-wrap justify-center gap-2">
          <label
            className={cn(
              pill,
              "cursor-pointer bg-foreground text-background has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            <ImagePlusIcon className="size-4" />
            {logo ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                e.currentTarget.value = ""
                if (file) onLogo(file)
              }}
            />
          </label>
          {logo && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => onLogo(null)}
              className={cn(pill, "bg-muted hover:bg-muted/70 disabled:opacity-60")}
            >
              <ImageOffIcon className="size-4" />
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF. Square images look best.</p>
      </LayerBody>
    </>
  )
}

function ArchiveProject({
  project,
  open,
  onOpenChange,
  onArchived,
}: {
  project: SceneProject
  open: boolean
  onOpenChange: (open: boolean) => void
  onArchived: () => void
}) {
  const [pending, start] = useTransition()
  return (
    <Layer open={open} onOpenChange={onOpenChange}>
      <LayerHead title={`Archive ${project.name}?`} />
      <LayerBody className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          It and its tasks leave every list. You can restore it any time from Archived projects in the workspace drawer.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await archiveProject(project.id)
                if (res.error) return void toast.error(res.error)
                toast.success("Project archived")
                onArchived()
              })
            }
            className={cn(pill, "bg-muted px-5 text-destructive hover:bg-muted/70 disabled:opacity-60")}
          >
            <ArchiveIcon className="size-4" />
            {pending ? "Archiving" : "Archive project"}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className={cn(pill, "hover:bg-muted")}>
            Cancel
          </button>
        </div>
      </LayerBody>
    </Layer>
  )
}

function StatusPanel({
  status,
  count,
  cards,
  onNewTask,
}: {
  status: TaskStatus
  count: number
  cards: WorkspaceCard[]
  onNewTask: () => void
}) {
  return (
    <>
      <LayerHead
        title={STATUS[status].label}
        titleClassName={STATUS[status].className}
        description={<span className="tabular">{count} tasks. Drag a block onto another station to move it.</span>}
      />
      <LayerBody className="flex flex-col gap-6">
        <NewTaskButton onClick={onNewTask} />
        <Tasks title="Tasks" cards={cards} none="Nothing here right now." />
      </LayerBody>
    </>
  )
}

function MemberPanel({
  member,
  user,
  cards,
  onNewTask,
}: {
  member: SceneMember
  user?: MemberLite
  cards: WorkspaceCard[]
  onNewTask: () => void
}) {
  const first = member.name.split(" ")[0]
  return (
    <>
      <LayerHead
        mark={<UserAvatar user={user ?? { name: member.name, image: null }} className="size-11" />}
        title={member.name}
        description={
          <>
            <span className="tabular">{member.open} open</span>
            <span className={cn("tabular", member.active && STATUS.in_progress.className)}>{member.active} in progress</span>
            {member.overdue > 0 && <span className={cn("tabular", HEALTH.overdue.className)}>{member.overdue} overdue</span>}
          </>
        }
      />
      <LayerBody className="flex flex-col gap-6">
        <NewTaskButton onClick={onNewTask}>New task for {first}</NewTaskButton>
        <Tasks title="Open tasks" cards={cards} none={`${first} has nothing open. Drag unassigned work onto their station.`} />
      </LayerBody>
    </>
  )
}
