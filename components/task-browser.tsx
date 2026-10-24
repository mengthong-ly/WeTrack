"use client"

import { CalendarDaysIcon, FlagIcon, KanbanIcon, LayoutGridIcon, ListIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { LoadMore, ProjectDot, UserAvatar } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { Pick } from "@/components/pick"
import { Button } from "@/components/ui/button"
import { PillTabs } from "@/components/pill-tabs"
import { TaskBoard } from "@/components/task-board"
import { TaskCalendar } from "@/components/task-calendar"
import { TaskList } from "@/components/task-card"
import { type GridTask, TaskGrid } from "@/components/task-grid"
import { TaskTable } from "@/components/task-table"
import type { MemberLite, ProjectLite } from "@/lib/options"
import { groupByDate, normalizeParams, paramsKey, readParams, STATUS_TABS, type StatusTab, TASK_PAGE, TASK_SHOW_MAX, type TaskView } from "@/lib/task-views"
import { type ListPage, useServerList } from "@/lib/use-server-list"
import { cn, isTyping } from "@/lib/utils"

export type BrowserTask = GridTask & {
  projectId: string
  assigneeId: string | null
  completedAt: number | null
}

const STATUS_LABEL: Record<StatusTab, string> = { open: "Open", active: "In progress", done: "Completed", all: "All" }
const VIEWS: { key: TaskView; label: string; icon: typeof ListIcon }[] = [
  { key: "cards", label: "Cards", icon: LayoutGridIcon },
  { key: "date", label: "Date", icon: ListIcon },
  { key: "priority", label: "Priority", icon: FlagIcon },
  { key: "board", label: "Board", icon: KanbanIcon },
  { key: "calendar", label: "Calendar", icon: CalendarDaysIcon },
]
const EVERYONE = "everyone"

// Filters live in the URL but change through the History API, which Next keeps in sync with useSearchParams
// without a navigation, so the page never remounts; useServerList then fetches the rows for the new URL.
// A new filter starts from the first page again. Old URLs are rewritten on the first change (normalizeParams).
function setParam(meId: string, key: string, value: string | null, { replace = false } = {}) {
  const params = normalizeParams(new URLSearchParams(window.location.search), meId)
  if (value) params.set(key, value)
  else params.delete(key)
  if (key !== "show" && key !== "month") params.delete("show")
  const q = params.toString()
  window.history[replace ? "replaceState" : "pushState"](null, "", q ? `?${q}` : window.location.pathname)
}

export function TaskBrowser({
  initial,
  projects,
  members,
  meId,
  today,
}: {
  initial: ListPage<BrowserTask> // the page the server rendered for the URL
  projects: ProjectLite[]
  members: MemberLite[]
  meId: string
  today: string
}) {
  const params = readParams(useSearchParams(), meId)
  const { view, status, person, projectId } = params
  const board = view === "board"
  const set = (key: string, value: string | null, opts?: { replace?: boolean }) => setParam(meId, key, value, opts)
  const { rows: shown, total, pending, appending } = useServerList(initial, paramsKey(params), "/api/tasks")
  const search = useRef<HTMLInputElement>(null)

  // Search goes to the URL (and so the database) a beat after typing stops. Back and Forward bring their
  // own text back into the field.
  const [query, setQuery] = useState(params.q)
  const sent = useRef(params.q)
  useEffect(() => {
    if (params.q === sent.current) return
    sent.current = params.q
    setQuery(params.q)
  }, [params.q])
  useEffect(() => {
    const q = query.trim()
    if (q === sent.current) return
    const id = setTimeout(() => {
      sent.current = q
      setParam(meId, "q", q || null, { replace: true })
    }, 250)
    return () => clearTimeout(id)
  }, [query, meId])

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

  const groups =
    status === "done" ? [{ key: "done", title: "Completed", tasks: shown }] : groupByDate(shown, today)
  const filtering = !!(params.q || person || projectId)
  const capped = shown.length < total && params.show >= TASK_SHOW_MAX

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="flex items-baseline gap-3 text-3xl font-light tracking-tight sm:text-4xl">
            Tasks
            <span className="tabular text-base text-muted-foreground">{total}</span>
          </h1>
          <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/tasks/new" />}
            className="h-11 gap-2 rounded-full px-5 transition-[background-color,scale] active:scale-95"
          >
            <PlusIcon className="size-4" />
            Add task
          </Button>
          <PillTabs
            id="layout"
            items={VIEWS.map(({ key, label, icon: Icon }) => ({
              key,
              label: (
                <>
                  <Icon className="size-4" />
                  <span className="sr-only md:not-sr-only">{label}</span>
                </>
              ),
              active: key === view,
              onSelect: () => set("view", key === "cards" ? null : key),
            }))}
          />
          </div>
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
              set("person", v === EVERYONE ? null : v)
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
            id="status"
            className="max-w-full self-start"
            items={STATUS_TABS.map((s) => ({
              key: s,
              label: STATUS_LABEL[s],
              active: s === status,
              onSelect: () => set("status", s === "all" ? null : s),
            }))}
          />
        )}
        {projects.length > 0 && (
          <PillTabs
            id="project"
            className="max-w-full self-start"
            items={[
              {
                key: "all",
                label: "All projects",
                active: !projectId,
                onSelect: () => set("project", null),
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
                onSelect: () => set("project", p.id),
              })),
            ]}
          />
        )}
      </div>

      {/* The rows on screen stay while the next ones load, dimmed, then animate to the new set. */}
      <div aria-busy={pending} className={cn("flex flex-col gap-4 transition-opacity duration-200", pending && !appending && "opacity-60")}>
        {board ? (
          <TaskBoard tasks={shown} />
        ) : view === "priority" ? (
          <TaskTable tasks={shown} />
        ) : view === "calendar" ? (
          <TaskCalendar
            tasks={shown}
            today={today}
            month={params.month ?? today.slice(0, 7)}
            onMonth={(m) => set("month", m === today.slice(0, 7) ? null : m, { replace: true })}
          />
        ) : view === "cards" ? (
          <TaskGrid tasks={shown} empty={filtering ? "Nothing matches these filters." : "No tasks here. Press C to add one."} />
        ) : (
          // No `layout` here: a size animation scales the card, and when a tab switch interrupts it the
          // sections' counter-scale falls out of step and stretches everything inside.
          <div className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
            {groups.map((g) => (
              <motion.section key={g.key} layout="position" transition={spring}>
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
        {view !== "calendar" &&
          (capped ? (
            <p className="text-center text-sm text-muted-foreground">
              Showing the first {TASK_SHOW_MAX}. Search or filter to find the rest.
            </p>
          ) : (
            <LoadMore
              left={total - shown.length}
              pending={appending}
              onClick={() => set("show", String(Math.min(params.show + TASK_PAGE, TASK_SHOW_MAX)), { replace: true })}
            />
          ))}
      </div>
    </>
  )
}
