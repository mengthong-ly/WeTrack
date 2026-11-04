// Pure helpers behind the Tasks page views: URL params and deadline groups. Dates are "YYYY-MM-DD" strings.
import { readPage, readSort, setSort } from "./paging.ts"

// The table is the default; cards, date and priority show the same page of rows another way. Old ?view=board and
// ?view=calendar links fall back to the table.
export const TASK_VIEWS = ["table", "cards", "date", "priority"] as const
export type TaskView = (typeof TASK_VIEWS)[number]
export const STATUS_TABS = ["open", "active", "done", "all"] as const
export type StatusTab = (typeof STATUS_TABS)[number]
export const TASK_SORTS = ["title", "status", "priority", "assignee", "deadline"] as const
export type TaskSort = (typeof TASK_SORTS)[number]

const isView = (v: string | null): v is TaskView => TASK_VIEWS.includes(v as TaskView)
const isStatus = (v: string | null): v is StatusTab => STATUS_TABS.includes(v as StatusTab)

// Old links used ?view=<status tab>, ?view=mine and ?layout=board. Rewrite them to ?status and ?person.
export function normalizeParams(params: URLSearchParams, meId: string) {
  const p = new URLSearchParams(params)
  const view = p.get("view")
  if (view === "mine") {
    p.set("person", meId)
    p.set("status", "open")
    p.delete("view")
  } else if (isStatus(view)) {
    p.set("status", view)
    p.delete("view")
  }
  p.delete("layout")
  return p
}

export function readParams(params: URLSearchParams, meId: string) {
  const p = normalizeParams(params, meId)
  const view = p.get("view")
  const status = p.get("status")
  return {
    view: isView(view) ? view : "table",
    status: isStatus(status) ? status : "all",
    person: p.get("person"),
    projectId: p.get("project"),
    q: p.get("q")?.trim().slice(0, 100) ?? "",
    page: readPage(p),
    ...readSort(p, TASK_SORTS),
  }
}
export type TaskParams = ReturnType<typeof readParams>

// One string per page of results, built the same way on the server and the client: the server renders it into
// the page, the client fetches /api/tasks?<key> when the URL changes under it. Defaults are left out.
export function paramsKey(p: TaskParams) {
  const q = new URLSearchParams()
  if (p.view !== "table") q.set("view", p.view)
  if (p.status !== "all") q.set("status", p.status)
  if (p.person) q.set("person", p.person)
  if (p.projectId) q.set("project", p.projectId)
  if (p.q) q.set("q", p.q)
  setSort(q, p)
  if (p.page > 1) q.set("page", String(p.page))
  return q.toString()
}

type Dated = { status: string; deadline: string | null }

// The Date view: overdue first, then one group per deadline day (soonest first), then No deadline. Work finished
// before today goes last, newest first, so the top of the list is always what's next.
export function groupByDate<T extends Dated>(tasks: T[], today: string) {
  const overdue: T[] = []
  const days = new Map<string, T[]>()
  const undated: T[] = []
  const earlier: T[] = []
  for (const t of tasks) {
    if (!t.deadline) undated.push(t)
    else if (t.deadline >= today) days.set(t.deadline, [...(days.get(t.deadline) ?? []), t])
    else if (t.status === "completed") earlier.unshift(t)
    else overdue.push(t)
  }
  return [
    { key: "overdue", title: "Overdue", tasks: overdue },
    ...[...days.keys()].sort().map((day) => ({ key: day, title: dayLabel(day, today), tasks: days.get(day)! })),
    { key: "none", title: "No deadline", tasks: undated },
    { key: "earlier", title: "Completed earlier", tasks: earlier },
  ].filter((g) => g.tasks.length > 0)
}

export function dayLabel(day: string, today: string) {
  const diff = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(day.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
  })
}
