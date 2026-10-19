"use client"

import { motion } from "motion/react"
import { useSearchParams } from "next/navigation"

import { ProjectDot } from "@/components/bits"
import { spring } from "@/components/motion-bits"
import { PillTabs } from "@/components/pill-tabs"
import { type TaskCardData, TaskList } from "@/components/task-card"
import type { ProjectLite } from "@/lib/options"
import { daysBetween } from "@/lib/schedule"

export type BrowserTask = TaskCardData & {
  projectId: string
  assigneeId: string | null
  completedAt: number | null
}

const ACTIVE = ["in_progress", "review", "blocked"]
const VIEWS = {
  open: { label: "Open", match: (t: BrowserTask) => t.status !== "completed" },
  mine: {
    label: "Mine",
    match: (t: BrowserTask, me: string) =>
      t.status !== "completed" && t.assigneeId === me,
  },
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
  meId,
  today,
}: {
  tasks: BrowserTask[] // already sorted by deadline on the server
  projects: ProjectLite[]
  meId: string
  today: string
}) {
  const params = useSearchParams()
  const viewParam = params.get("view")
  const view: View =
    viewParam && viewParam in VIEWS ? (viewParam as View) : "open"
  const projectId = params.get("project")

  const shown = tasks.filter(
    (t) =>
      VIEWS[view].match(t, meId) && (!projectId || t.projectId === projectId)
  )
  if (view === "done")
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

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-light tracking-tight sm:text-4xl">
            Tasks
          </h1>
          <span className="tabular text-muted-foreground">{shown.length}</span>
        </div>
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

      <motion.div
        layout
        transition={spring}
        className="flex flex-col gap-6 rounded-sheet bg-card p-3 shadow-sm sm:p-4"
      >
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
            No tasks here. Press C to add one.
          </p>
        )}
      </motion.div>
    </>
  )
}
