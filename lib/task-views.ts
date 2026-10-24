// Pure helpers behind the Tasks page views: URL params, deadline groups and month paging.
// Dates are "YYYY-MM-DD" strings, months "YYYY-MM".

export const TASK_VIEWS = ["cards", "date", "priority", "board", "calendar"] as const
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

// The Tasks page loads this many rows at a time; ?show= is how many are on screen (Load more raises it).
export const TASK_PAGE = 50
export const TASK_SHOW_MAX = 500
const isMonth = (v: string | null): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

export function readParams(params: URLSearchParams, meId: string) {
  const p = normalizeParams(params, meId)
  const view = p.get("view")
  const status = p.get("status")
  const show = Math.floor(Number(p.get("show")))
  const month = p.get("month")
  return {
    view: isView(view) ? view : "cards",
    status: isStatus(status) ? status : "all",
    person: p.get("person"),
    projectId: p.get("project"),
    q: p.get("q")?.trim().slice(0, 100) ?? "",
    show: show > TASK_PAGE ? Math.min(show, TASK_SHOW_MAX) : TASK_PAGE,
    month: isMonth(month) ? month : null,
  }
}
export type TaskParams = ReturnType<typeof readParams>

// One string per page of results, built the same way on the server and the client: the server renders it into
// the page, the client fetches /api/tasks?<key> when the URL changes under it. Defaults are left out.
export function paramsKey(p: TaskParams) {
  const q = new URLSearchParams()
  if (p.view !== "cards") q.set("view", p.view)
  if (p.status !== "all") q.set("status", p.status)
  if (p.person) q.set("person", p.person)
  if (p.projectId) q.set("project", p.projectId)
  if (p.q) q.set("q", p.q)
  if (p.view === "calendar") {
    if (p.month) q.set("month", p.month)
  } else if (p.show !== TASK_PAGE) q.set("show", String(p.show))
  return q.toString()
}

// The calendar's days, with the week either side the grid shows: [from, to) as "YYYY-MM-DD".
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number)
  return [iso(y, m - 1, 1 - 6), iso(y, m, 1 + 6)] as const
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

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number)
  return iso(y, m - 1 + n, 1).slice(0, 7)
}
