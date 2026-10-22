import type { TaskStatus } from "@/lib/db/enums"
import type { TaskRow } from "@/lib/queries"
import {
  type Countable,
  daysBetween,
  doneThisWeek,
  effectiveProgress,
  health,
  isoDay,
  projectHealth,
} from "@/lib/schedule"
import { byDeadline } from "@/lib/task-view"

export const ACTIVE: TaskStatus[] = ["in_progress", "review", "blocked"]

// Numbers shared by the home dashboard and the public CEO page.
export function summarize(tasks: TaskRow[], today: string) {
  const open = tasks.filter((t) => t.status !== "completed")
  return {
    total: tasks.length,
    open: open.length,
    done: tasks.length - open.length,
    doneThisWeek: tasks.filter((t) => doneThisWeek(t, today)).length,
    overdue: open.filter((t) => health(t, today) === "overdue").length,
    dueSoon: open.filter((t) => health(t, today) === "due_soon").length,
    dueThisWeek: open.filter(
      (t) => t.deadline && daysBetween(today, t.deadline) <= 7
    ).length,
    blocked: open.filter((t) => t.status === "blocked").length,
    focus: tasks.filter((t) => ACTIVE.includes(t.status)).sort(byDeadline),
    upNext: open.filter((t) => !ACTIVE.includes(t.status)).sort(byDeadline),
  }
}

// Projects with no tasks are left out unless `keepEmpty` (the 3D workspace shows new, empty projects).
export function projectProgress(
  projects: { id: string; name: string; color: string }[],
  tasks: TaskRow[],
  today: string,
  { keepEmpty = false } = {}
) {
  return projects
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id)
      const open = pt.filter((t) => t.status !== "completed")
      const progress = pt.length
        ? Math.round(
            pt.reduce((s, t) => s + effectiveProgress(t), 0) / pt.length
          )
        : 0
      return {
        ...p,
        total: pt.length,
        open: open.length,
        overdue: open.filter((t) => health(t, today) === "overdue").length,
        next: open.filter((t) => t.deadline).sort(byDeadline)[0] ?? null,
        health: projectHealth(pt, today),
        progress,
      }
    })
    .filter((p) => keepEmpty || p.total > 0)
    .sort((a, b) => b.open - a.open)
}

// Per-person load, for the Team page and the CEO view.
export function workload<M extends { id: string }>(
  members: M[],
  tasks: (Countable & { assigneeId: string | null })[],
  today: string
) {
  return members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.id)
    const open = mine.filter((t) => t.status !== "completed")
    return {
      member: m,
      open: open.length,
      active: open.filter((t) => (ACTIVE as string[]).includes(t.status)).length,
      blocked: open.filter((t) => t.status === "blocked").length,
      overdue: open.filter((t) => health(t, today) === "overdue").length,
      dueThisWeek: open.filter((t) => t.deadline && daysBetween(today, t.deadline) <= 7).length,
      doneThisWeek: mine.filter((t) => doneThisWeek(t, today)).length,
    }
  })
}

export const STALE_DAYS = 5
export type Attention = "overdue" | "blocked" | "stale" | "unassigned"

// Open work someone should look at, worst first. One reason per task: the most urgent one.
export function needsAttention(tasks: TaskRow[], today: string) {
  const reason = (t: TaskRow): Attention | null => {
    if (t.status === "completed") return null
    if (health(t, today) === "overdue") return "overdue"
    if (t.status === "blocked") return "blocked"
    if (ACTIVE.includes(t.status) && daysBetween(isoDay(t.updatedAt), today) >= STALE_DAYS) return "stale"
    if (!t.assigneeId) return "unassigned"
    return null
  }
  const rank: Attention[] = ["overdue", "blocked", "stale", "unassigned"]
  return tasks
    .map((t) => ({ task: t, reason: reason(t) }))
    .filter((x): x is { task: TaskRow; reason: Attention } => x.reason !== null)
    .sort((a, b) => rank.indexOf(a.reason) - rank.indexOf(b.reason) || byDeadline(a.task, b.task))
}
