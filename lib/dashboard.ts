import type { TaskStatus } from "@/lib/db/enums"
import type { TaskRow } from "@/lib/queries"
import { daysBetween, effectiveProgress, health } from "@/lib/schedule"
import { byDeadline } from "@/lib/task-view"

export const ACTIVE: TaskStatus[] = ["in_progress", "review", "blocked"]

// Numbers shared by the home dashboard and the public CEO page.
export function summarize(tasks: TaskRow[], today: string) {
  const open = tasks.filter((t) => t.status !== "completed")
  return {
    total: tasks.length,
    open: open.length,
    done: tasks.length - open.length,
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

export function projectProgress(
  projects: { id: string; name: string; color: string }[],
  tasks: TaskRow[]
) {
  return projects
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id)
      const progress = pt.length
        ? Math.round(
            pt.reduce((s, t) => s + effectiveProgress(t), 0) / pt.length
          )
        : 0
      return {
        ...p,
        total: pt.length,
        open: pt.filter((t) => t.status !== "completed").length,
        progress,
      }
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.open - a.open)
}
