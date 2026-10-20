// Pure helpers behind the Tasks page views: URL params, deadline groups and the month grid.
// Dates are "YYYY-MM-DD" strings, months "YYYY-MM".

export const TASK_VIEWS = ["date", "priority", "board", "calendar"] as const
export type TaskView = (typeof TASK_VIEWS)[number]
export const STATUS_TABS = ["open", "active", "done", "all"] as const
export type StatusTab = (typeof STATUS_TABS)[number]

const isView = (v: string | null): v is TaskView => TASK_VIEWS.includes(v as TaskView)
const isStatus = (v: string | null): v is StatusTab => STATUS_TABS.includes(v as StatusTab)

// Old links used ?view=<status tab>, ?view=mine and ?layout=board. Rewrite them to ?status, ?person and ?view.
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
  if (p.get("layout") === "board") p.set("view", "board")
  p.delete("layout")
  return p
}

export function readParams(params: URLSearchParams, meId: string) {
  const p = normalizeParams(params, meId)
  const view = p.get("view")
  const status = p.get("status")
  return {
    view: isView(view) ? view : "date",
    status: isStatus(status) ? status : "all",
    person: p.get("person"),
    projectId: p.get("project"),
  }
}

type Dated = { status: string; deadline: string | null }

// Overdue first, then one group per deadline day (soonest first), then No deadline. Work finished
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

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10)

// Every day shown on a Monday-first month grid: whole weeks covering the month.
export function monthGrid(month: string) {
  const [y, m] = month.split("-").map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return Array.from({ length: Math.ceil((lead + length) / 7) * 7 }, (_, i) => iso(y, m - 1, 1 - lead + i))
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number)
  return iso(y, m - 1 + n, 1).slice(0, 7)
}
