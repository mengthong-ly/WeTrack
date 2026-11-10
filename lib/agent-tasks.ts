// Pure shaping of task rows for the agent API: a compact JSON shape and the list filters.

export const TASK_LIST_LIMIT = 50

// The subset of TaskRow (lib/queries.ts) read here; a real TaskRow is assignable to it.
export type TaskLike = {
  id: string
  title: string
  project: { id: string; name: string }
  status: string
  priority: string
  progress: number
  deadline: string | null
  assignees: { userId: string; user: { name: string } }[]
  parentId: string | null
  updatedAt: Date
}

export type AgentTask = {
  id: string
  title: string
  project: { id: string; name: string }
  status: string
  priority: string
  progress: number
  deadline: string | null
  assignees: string[]
  parentId: string | null
  updatedAt: string
}

export function compactTask(t: TaskLike): AgentTask {
  return {
    id: t.id,
    title: t.title,
    project: { id: t.project.id, name: t.project.name },
    status: t.status,
    priority: t.priority,
    progress: t.progress,
    deadline: t.deadline,
    assignees: t.assignees.map((a) => a.user.name),
    parentId: t.parentId,
    updatedAt: t.updatedAt.toISOString(),
  }
}

// Filters AND together; empty or absent ones are ignored. `q` is a literal, case-insensitive substring of the title.
// `assignee` is a user id matched against assignees[].userId, the same rule as assignedTo in lib/task-view.ts.
export function matchTasks(
  rows: TaskLike[],
  f: { q?: string; status?: string; project?: string; assignee?: string },
): TaskLike[] {
  const q = f.q?.toLowerCase()
  return rows.filter(
    (t) =>
      (!q || t.title.toLowerCase().includes(q)) &&
      (!f.status || t.status === f.status) &&
      (!f.project || t.project.id === f.project) &&
      (!f.assignee || t.assignees.some((a) => a.userId === f.assignee)),
  )
}
