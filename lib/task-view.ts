import type { TaskRow } from "@/lib/queries"
import { plainText } from "@/lib/markdown"
import { effectiveProgress, health } from "@/lib/schedule"
import type { TaskCardData } from "@/components/task-card"

// Server → client shape for task cards (derived fields computed once, on the server).
export function toCard(t: TaskRow, today: string): TaskCardData {
  return {
    id: t.id,
    title: t.title,
    description: t.description && plainText(t.description),
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    progress: effectiveProgress(t),
    health: health(t, today),
    project: t.project,
    assignee: t.assignee,
    subtasks: { done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length },
  }
}

const PRIORITY_RANK = { urgent: 0, normal: 1, no_rush: 2 } as const

// Soonest deadline first, undated last, then urgency.
export function byDeadline(a: TaskRow, b: TaskRow) {
  if (a.deadline !== b.deadline) {
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline < b.deadline ? -1 : 1
  }
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}
