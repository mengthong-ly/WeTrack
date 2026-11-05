import type { BrowserTask } from "@/components/task-browser"
import type { PagedTaskRow, TaskRow } from "@/lib/queries"
import { plainText } from "@/lib/markdown"
import { effectiveProgress, health } from "@/lib/schedule"
import type { TaskCardData } from "@/components/task-card"

// Everyone a task is assigned to, the lead (task.assigneeId) first.
export function assigneesOf(t: { assigneeId: string | null; assignees: { user: { id: string; name: string; image: string | null } }[] }) {
  return t.assignees.map((a) => a.user).sort((a, b) => Number(b.id === t.assigneeId) - Number(a.id === t.assigneeId))
}

// Whether a task is assigned to this person, as lead or not.
export function assignedTo(t: { assignees: { userId: string }[] }, userId: string) {
  return t.assignees.some((a) => a.userId === userId)
}

// Server → client shape for task cards (derived fields computed once, on the server).
export function toCard(t: TaskRow, today: string): TaskCardData {
  return {
    id: t.id,
    title: t.title,
    description: t.preview && plainText(t.preview),
    status: t.status,
    priority: t.priority,
    deadline: t.deadline,
    progress: effectiveProgress(t),
    health: health(t, today),
    projectId: t.projectId,
    project: t.project,
    assignee: t.assignee,
    assignees: assigneesOf(t),
    subtasks: { done: t.subtasks.filter((s) => s.status === "completed").length, total: t.subtasks.length },
  }
}

// A row of the Tasks page: the card, plus the start of its description for the Cards view's document thumbnail.
export function toBrowserTask(t: PagedTaskRow, today: string): BrowserTask {
  return {
    ...toCard({ ...t, preview: t.body }, today),
    body: t.body,
    assigneeId: t.assigneeId,
    completedAt: t.completedAt?.getTime() ?? null,
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
