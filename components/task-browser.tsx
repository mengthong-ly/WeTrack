"use client"

import { KanbanIcon, ListIcon, SearchIcon, XIcon } from "lucide-react"
import { motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import { useDeferredValue, useEffect, useRef, useState } from "react"

import { ProjectDot, UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { Pick } from "@/components/pick"
import { PillTabs } from "@/components/pill-tabs"
import { TaskBoard } from "@/components/task-board"
import { type TaskCardData, TaskList } from "@/components/task-card"
import type { MemberLite, ProjectLite } from "@/lib/options"
import { daysBetween } from "@/lib/schedule"
import { isTyping } from "@/lib/utils"

export type BrowserTask = TaskCardData & {
  projectId: string
  assigneeId: string | null
  completedAt: number | null
}

const ACTIVE = ["in_progress", "review", "blocked"]
const VIEWS = {
  open: { label: "Open", match: (t: BrowserTask) => t.status !== "completed" },
  active: {
    label: "In progress",
    match: (t: BrowserTask) => ACTIVE.includes(t.status),
  },
  done: {
    label: "Completed",
    match: (t: BrowserTask) => t.status === "completed",
  },
  all: { label: "All", match: () => true },
} as const
type View = keyof typeof VIEWS
const EVERYONE = "everyone"
const WEEK_MS = 7 * 86_400_000

// Filters live in the URL but change through the History API, which Next keeps in sync with
// useSearchParams without a server round trip — so the page never remounts and only the list animates.
function setParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (value) params.set(key, value)
  else params.delete(key)
  const q = params.toString()
  window.history.pushState(null, "", q ? `?${q}` : window.location.pathname)
}

export function TaskBrowser({
  tasks,
  projects,
  members,
  meId,
  today,
}: {
  tasks: BrowserTask[] // already sorted by deadline on the server
  projects: ProjectLite[]
  members: MemberLite[]
  meId: string
  today: string
}) {
  const params = useSearchParams()
  const board = params.get("layout") === "board"
  const viewParam = params.get("view")
  // "?view=mine" was the old My tasks tab; it now means "open, assigned to me".
  const view: View =
    viewParam && viewParam in VIEWS ? (viewParam as View) : "open"
  const projectId = params.get("project")
  const person = viewParam === "mine" ? meId : params.get("person")
  const [query, setQuery] = useState("")
  const q = useDeferredValue(query.trim().toLowerCase())
  const search = useRef<HTMLInputElement>(null)

  // "/" jumps to search, like most trackers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !isTyping(e.target)) {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const filtered = tasks.filter(
    (t) =>
      (!projectId || t.projectId === projectId) &&
      (!person || t.assigneeId === person) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.project.name.toLowerCase().includes(q) ||
        t.assignee?.name.toLowerCase().includes(q))
  )
  // The board shows every status; done work only from the last week so the column stays short.
  const weekAgo = Date.parse(today) - WEEK_MS
  const shown = board
    ? filtered.filter((t) => t.status !== "completed" || (t.completedAt ?? 0) > weekAgo)
    : filtered.filter((t) => VIEWS[view].match(t))
  if (!board && view === "done")
    shown.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  const open = (t: BrowserTask) => t.status !== "completed"
  const groups = (
    view === "done"
      ? [{ title: "Completed", tasks: shown }]
      : [
          {
            title: "Overdue",
            tasks: shown.filter(
              (t) => open(t) && t.deadline && t.deadline < today
            ),
          },
          {
            title: "This week",
            tasks: shown.filter(
              (t) =>
                open(t) &&
                t.deadline &&
                t.deadline >= today &&
                daysBetween(today, t.deadline) <= 7
            ),
          },
          {
            title: "Later",
            tasks: shown.filter(
              (t) => open(t) && t.deadline && daysBetween(today, t.deadline) > 7
            ),
          },
          {
            title: "No deadline",
            tasks: shown.filter((t) => open(t) && !t.deadline),
          },
          { title: "Completed", tasks: shown.filter((t) => !open(t)) },
        ]
  ).filter((g) => g.tasks.length > 0)

  const filtering = !!(q || person || projectId)

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-baseline gap-3 text-3xl font-light tracking-tight sm:text-4xl">
            Tasks
            <span className="tabular text-base text-muted-foreground">{shown.length}</span>
          </h1>
          <PillTabs
            id="layout"
            items={[
              {
                key: "list",
                label: (
                  <>
                    <ListIcon className="size-4" />
                    <span className="sr-only sm:not-sr-only">List</span>
                  </>
                ),
                active: !board,
                onSelect: () => setParam("layout", null),
              },
              {
                key: "board",
                label: (
                  <>
                    <KanbanIcon className="size-4" />
                    <span className="sr-only sm:not-sr-only">Board</span>
                  </>
                ),
                active: board,
                onSelect: () => setParam("layout", "board"),
              },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex h-11 min-w-0 flex-1 basis-56 items-center rounded-full bg-card/70 ring-1 ring-foreground/5 backdrop-blur transition focus-within:bg-card focus-within:ring-foreground/15">
            <SearchIcon className="pointer-events-none absolute left-4 size-4 text-muted-foreground" />
            <span className="sr-only">Search tasks</span>
            <input
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("")
                  e.currentTarget.blur()
                }
              }}
              placeholder="Search tasks, projects, people"
              className="h-full w-full min-w-0 rounded-full bg-transparent pr-10 pl-10 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 hidden h-5 min-w-5 place-items-center rounded-md bg-muted px-1 font-sans text-[11px] text-foreground sm:grid">
                /
              </kbd>
            )}
          </label>
          <Pick
            aria-label="Person"
            className="h-11 min-w-40 bg-card/70 px-4 ring-1 ring-foreground/5 backdrop-blur dark:bg-card/70"
            value={person ?? EVERYONE}
            onChange={(v) => {
              setParam("person", v === EVERYONE ? null : v)
              if (viewParam === "mine") setParam("view", null)
            }}
            options={[
              { value: EVERYONE, label: "Everyone" },
              ...[...members].sort((a, b) => Number(b.id === meId) - Number(a.id === meId)).map((m) => ({
                value: m.id,
                label: (
                  <span className="flex items-center gap-2">
                    <UserAvatar user={m} className="size-5 ring-0" />
                    {m.id === meId ? "Me" : m.name}
                  </span>
                ),
              })),
            ]}
          />
        </div>

        {!board && (
          <PillTabs
            id="view"
            className="self-start"
            items={(Object.keys(VIEWS) as View[]).map((v) => ({
              key: v,
              label: VIEWS[v].label,
              active: v === view,
              onSelect: () => setParam("view", v === "open" ? null : v),
            }))}
          />
        )}
        {projects.length > 0 && (
          <PillTabs
            id="project"
            className="self-start"
            items={[
              {
                key: "all",
                label: "All projects",
                active: !projectId,
                onSelect: () => setParam("project", null),
              },
              ...projects.map((p) => ({
                key: p.id,
                label: (
                  <>
                    <ProjectDot color={p.color} />
                    {p.name}
                  </>
                ),
                active: p.id === projectId,
                onSelect: () => setParam("project", p.id),
              })),
            ]}
          />
        )}
      </div>

      {board ? (
        <TaskBoard tasks={shown} />
      ) : (
        // No `layout` here: a size animation scales the card, and when a tab switch interrupts it the
        // sections' counter-scale falls out of step and stretches everything inside.
        <div className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
          {groups.map((g) => (
            <motion.section key={g.title} layout="position" transition={spring}>
              <h2 className="flex items-baseline justify-between px-3 pt-2 pb-3 text-lg">
                {g.title}
                <span className="tabular text-sm text-muted-foreground">
                  {g.tasks.length}
                </span>
              </h2>
              <TaskList tasks={g.tasks} />
            </motion.section>
          ))}
          {groups.length === 0 && (
            <p className="px-5 py-12 text-center text-muted-foreground">
              {filtering ? "Nothing matches these filters." : "No tasks here. Press C to add one."}
            </p>
          )}
        </div>
      )}
    </>
  )
}
