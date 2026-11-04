"use client"

import { ClipboardListIcon, FlagIcon, LayoutGridIcon, ListIcon, PlusIcon, SearchXIcon, Table2Icon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { UserAvatar } from "@/components/bits"
import { Button } from "@/components/coss/button"
import {
  DataEmpty,
  DataFrame,
  DataPagination,
  FilterPick,
  FilterTabs,
  PageHead,
  SearchField,
  setSearchParams,
  Toolbar,
  ToolbarEnd,
  useClampPage,
} from "@/components/data-table"
import { spring } from "@/components/motion-bits"
import { TaskList } from "@/components/task-card"
import { type GridTask, TaskGrid } from "@/components/task-grid"
import { TaskPriorityTable } from "@/components/task-priority-table"
import { TaskTable } from "@/components/task-table"
import type { MemberLite } from "@/lib/options"
import { newTaskHref } from "@/lib/routes"
import { groupByDate, normalizeParams, paramsKey, readParams, STATUS_TABS, type StatusTab, type TaskView } from "@/lib/task-views"
import { type ListPage, useServerList } from "@/lib/use-server-list"
import { cn } from "@/lib/utils"

export type BrowserTask = GridTask & {
  assigneeId: string | null
  completedAt: number | null
}

const STATUS_LABEL: Record<StatusTab, string> = { open: "Open", active: "In progress", done: "Completed", all: "All" }
const FRAME_TITLE: Record<StatusTab, string> = { open: "Open tasks", active: "In progress", done: "Completed", all: "All tasks" }
const VIEWS: { value: TaskView; label: string; icon: typeof Table2Icon }[] = [
  { value: "table", label: "Table", icon: Table2Icon },
  { value: "cards", label: "Cards", icon: LayoutGridIcon },
  { value: "date", label: "Date", icon: ListIcon },
  { value: "priority", label: "Priority", icon: FlagIcon },
]
const EVERYONE = "everyone"
const FRAME = "tasks-table"

// One project's tasks as a data table, or the same page as cards, grouped by date or grouped by priority. Filters live in the URL and change through the
// History API (setSearchParams); old links are rewritten on the first change (normalizeParams).
export function TaskBrowser({
  initial,
  projectId,
  members,
  meId,
  today,
}: {
  initial: ListPage<BrowserTask> // the page the server rendered for the URL
  projectId: string
  members: MemberLite[]
  meId: string
  today: string
}) {
  const params = { ...readParams(useSearchParams(), meId), projectId }
  const { view, status, person, page } = params
  const { rows, total, pending } = useServerList(initial, paramsKey(params), "/api/tasks")
  useClampPage(page, total, rows.length, pending)

  // Rewrite old ?view=mine style links before the first change, so they don't linger in the URL.
  const set = (updates: Record<string, string | null>, opts?: { replace?: boolean }) => {
    const q = normalizeParams(new URLSearchParams(window.location.search), meId)
    window.history.replaceState(null, "", q.size ? `?${q}` : window.location.pathname)
    setSearchParams(updates, opts)
  }
  const filtering = !!(params.q || person || status !== "all")
  const addTask = (
    <Button render={<Link href={newTaskHref(projectId)} />}>
      <PlusIcon />
      Add task
    </Button>
  )
  const empty = filtering ? (
    <DataEmpty
      icon={<SearchXIcon />}
      title="No tasks match"
      description="Nothing here fits this search and these filters."
      action={
        <Button variant="outline" onClick={() => set({ q: null, person: null, status: null })}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <DataEmpty
      icon={<ClipboardListIcon />}
      title="No tasks yet"
      description="Add the first task for this project, or press C anywhere."
      action={addTask}
    />
  )
  const pagination = (
    <DataPagination frameId={FRAME} page={page} total={total} onPage={(p) => set({ page: p > 1 ? String(p) : null })} />
  )

  return (
    <>
      <PageHead tone="info"
        icon={<ClipboardListIcon />}
        title="Tasks"
        count={total}
        description="Everything in this project, overdue first, then by deadline."
        actions={
          <>
            <FilterTabs
              label="View"
              value={view}
              onChange={(v) => set({ view: v === "table" ? null : v })}
              items={VIEWS.map(({ value, label, icon: Icon }) => ({
                value,
                label: (
                  <>
                    <Icon className="size-4" />
                    <span className="sr-only md:not-sr-only">{label}</span>
                  </>
                ),
              }))}
            />
            {addTask}
          </>
        }
      />

      <Toolbar>
        <FilterTabs
          label="Status"
          value={status}
          onChange={(s) => set({ status: s === "all" ? null : s })}
          items={STATUS_TABS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
        />
        <ToolbarEnd>
          <SearchField value={params.q} onChange={(q) => set({ q: q || null }, { replace: true })} placeholder="Search tasks and people" />
          <FilterPick
            aria-label="Assignee"
            value={person ?? EVERYONE}
            onChange={(v) => set({ person: v === EVERYONE ? null : v })}
            options={[
              { value: EVERYONE, label: "Everyone" },
              ...[...members]
                .sort((a, b) => Number(b.id === meId) - Number(a.id === meId))
                .map((m) => ({
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
        </ToolbarEnd>
      </Toolbar>

      {view === "table" || rows.length === 0 ? (
        <DataFrame id={FRAME} title={FRAME_TITLE[status]} total={total} pending={pending} footer={total > 0 && pagination}>
          {rows.length ? <TaskTable tasks={rows} sort={params} /> : empty}
        </DataFrame>
      ) : (
        // The other views show the same page of rows their own way, with the same pagination under them.
        <div id={FRAME} aria-busy={pending} className="flex scroll-mt-20 flex-col gap-4">
          <div className={cn("transition-opacity duration-200", pending && "opacity-60")}>
            {view === "cards" ? (
              <TaskGrid tasks={rows} empty={null} />
            ) : view === "priority" ? (
              <TaskPriorityTable tasks={rows} />
            ) : (
              <DateGroups tasks={rows} done={status === "done"} today={today} />
            )}
          </div>
          <div className="px-1">{pagination}</div>
        </div>
      )}
    </>
  )
}

// The Date view: the page's tasks under Overdue, each deadline day, No deadline and Completed earlier.
function DateGroups({ tasks, done, today }: { tasks: BrowserTask[]; done: boolean; today: string }) {
  const groups = done ? [{ key: "done", title: "Completed", tasks }] : groupByDate(tasks, today)
  // No `layout` on the sheet: a size animation scales the card, and when a tab switch interrupts it the sections'
  // counter-scale falls out of step and stretches everything inside.
  return (
    <div className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4">
      {groups.map((g) => (
        <motion.section key={g.key} layout="position" transition={spring}>
          <h2 className="flex items-baseline justify-between px-3 pt-2 pb-3 text-lg">
            {g.title}
            <span className="tabular text-sm text-muted-foreground">{g.tasks.length}</span>
          </h2>
          <TaskList tasks={g.tasks} />
        </motion.section>
      ))}
    </div>
  )
}
