import type { TaskPriority, TaskStatus } from "@/lib/db/enums"
import type { Health, ProjectHealth, ReleaseStage } from "@/lib/schedule"

export const STATUS: Record<TaskStatus, { label: string; className: string }> = {
  not_started: { label: "Not started", className: "text-muted-foreground" },
  in_progress: { label: "In progress", className: "text-orange-600 dark:text-orange-400" },
  review: { label: "Review / Test", className: "text-violet-600 dark:text-violet-400" },
  blocked: { label: "Blocked", className: "text-red-600 dark:text-red-400" },
  completed: { label: "Completed", className: "text-emerald-600 dark:text-emerald-400" },
}

export const PRIORITY: Record<TaskPriority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "text-red-600 dark:text-red-400" },
  normal: { label: "Normal", className: "text-blue-600 dark:text-blue-400" },
  no_rush: { label: "No rush", className: "text-muted-foreground" },
}

export const TYPE = { development: "Development", design: "Design", bug_fix: "Bug fix" } as const

export const HEALTH: Record<Health, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "text-red-600 dark:text-red-400" },
  due_soon: { label: "Due soon", className: "text-amber-600 dark:text-amber-400" },
  on_track: { label: "On track", className: "text-emerald-600 dark:text-emerald-400" },
  no_deadline: { label: "No deadline", className: "text-muted-foreground" },
  done: { label: "Done", className: "text-muted-foreground" },
}

// `dot` is the solid swatch for the small health marker next to a project.
export const PROJECT_HEALTH: Record<ProjectHealth, { label: string; className: string; dot: string }> = {
  off_track: { label: "Behind", className: "text-red-600 dark:text-red-400", dot: "bg-red-500" },
  at_risk: { label: "At risk", className: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  on_track: { label: "On track", className: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  done: { label: "All done", className: "text-muted-foreground", dot: "bg-muted-foreground" },
}

export const RELEASE_STAGE: Record<ReleaseStage, string> = {
  in_production: "In production",
  on_staging: "On staging",
  scheduled: "Scheduled",
  not_released: "Not released",
}

export const PROJECT_COLORS = ["#737373", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]

export function formatDate(iso: string | null | undefined, withYear = false) {
  if (!iso) return null
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  })
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
