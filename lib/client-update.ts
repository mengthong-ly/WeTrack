// Pure helpers for the "not yet told the client" list. No app imports, so node --test can load it.

export const CLIENT_KINDS = [
  "task_completed",
  "status_changed",
  "deadline_changed",
] as const

export type Bucket =
  "completed" | "review" | "in_progress" | "blocked" | "not_started"

export const BUCKETS: { key: Bucket; heading: string }[] = [
  { key: "completed", heading: "Done" },
  { key: "review", heading: "Ready for review" },
  { key: "in_progress", heading: "In progress" },
  { key: "blocked", heading: "Blocked" },
  { key: "not_started", heading: "Coming up" },
]

export type UpdateEvent = {
  id: string
  kind: string
  taskId: string | null
  createdAt: string
}
export type UpdateTask = {
  id: string
  title: string
  status: Bucket
  deadline: string | null
}

export type UpdateItem = {
  taskId: string
  ids: string[]
  title: string
  bucket: Bucket
  /** undefined = deadline didn't change; null = deadline removed */
  deadlineMoved: string | null | undefined
  since: string
}

// One item per task, described by the task's current state (not the event history),
// ordered Done → Review → In progress → Blocked → Coming up, oldest change first.
export function groupUpdates(
  events: UpdateEvent[],
  tasks: UpdateTask[]
): UpdateItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const items = new Map<string, UpdateItem>()
  for (const e of events) {
    const task = e.taskId ? byId.get(e.taskId) : undefined
    if (!task) continue
    const item = items.get(task.id) ?? {
      taskId: task.id,
      ids: [],
      title: task.title,
      bucket: task.status,
      deadlineMoved: undefined,
      since: e.createdAt,
    }
    item.ids.push(e.id)
    if (e.kind === "deadline_changed") item.deadlineMoved = task.deadline
    if (e.createdAt < item.since) item.since = e.createdAt
    items.set(task.id, item)
  }
  const order = BUCKETS.map((b) => b.key)
  return [...items.values()].sort(
    (a, b) =>
      order.indexOf(a.bucket) - order.indexOf(b.bucket) ||
      a.since.localeCompare(b.since)
  )
}

const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })

export function draftMessage(
  projectName: string,
  items: UpdateItem[],
  todayIso: string
) {
  const sections = BUCKETS.map(({ key, heading }) => {
    const lines = items
      .filter((i) => i.bucket === key)
      .map((i) => {
        const note =
          i.bucket === "completed" || i.deadlineMoved === undefined
            ? ""
            : i.deadlineMoved
              ? ` (new target date: ${day(i.deadlineMoved)})`
              : " (new date to be confirmed)"
        return `• ${i.title}${note}`
      })
    return lines.length ? `${heading}\n${lines.join("\n")}` : ""
  }).filter(Boolean)

  return [
    `Hi ${projectName} team, here's our latest progress (${day(todayIso)}):`,
    ...sections,
    "Let us know if you have any questions.",
  ].join("\n\n")
}
