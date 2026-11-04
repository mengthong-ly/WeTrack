// A page's `searchParams` as URLSearchParams, for the readers below and in task-views.ts.
export function toSearchParams(record: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(record)) for (const x of [v ?? []].flat()) q.append(k, x)
  return q
}

// Every data table pages the same way: ?page= (1-based) of PAGE_SIZE rows, counted in the database.
export const PAGE_SIZE = 25

export function readPage(params: URLSearchParams) {
  const n = Math.floor(Number(params.get("page")))
  return n > 1 ? n : 1
}
export const pageOffset = (page: number) => (page - 1) * PAGE_SIZE
export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

// The page buttons: every page up to 7, then always 7 slots (first, last, the current one and its neighbours, null
// for a gap) so the controls never change width as you page.
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  if (page <= 4) return [1, 2, 3, 4, 5, null, pages]
  if (page >= pages - 3) return [1, null, pages - 4, pages - 3, pages - 2, pages - 1, pages]
  return [1, null, page - 1, page, page + 1, null, pages]
}

// Column sorting, the same on every table: ?sort=<column>&dir=desc (asc is left out). Clicking a header goes
// ascending, then descending, then back to the table's own default order (no ?sort=).
export type SortDir = "asc" | "desc"
export type Sort<K extends string> = { sort: K | null; dir: SortDir }

export function readSort<K extends string>(params: URLSearchParams, keys: readonly K[]): Sort<K> {
  const sort = params.get("sort") as K
  return keys.includes(sort) ? { sort, dir: params.get("dir") === "desc" ? "desc" : "asc" } : { sort: null, dir: "asc" }
}

export function nextSort<K extends string>(cur: Sort<K>, key: K): Sort<K> {
  if (cur.sort !== key) return { sort: key, dir: "asc" }
  return cur.dir === "asc" ? { sort: key, dir: "desc" } : { sort: null, dir: "asc" }
}

// The URL updates for a sort (for setSearchParams): null removes the param.
export const sortParams = (s: Sort<string>) => ({ sort: s.sort, dir: s.sort && s.dir === "desc" ? "desc" : null })

// Sorting rows already on the client (Projects, Team): strings ignore case, empty values go last either way.
export function sortRows<T, K extends string>(rows: T[], s: Sort<K>, get: Record<K, (row: T) => string | number | null>) {
  if (!s.sort) return rows
  const value = get[s.sort]
  const sign = s.dir === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === y) return 0
    if (x === null) return 1
    if (y === null) return -1
    return sign * (typeof x === "string" && typeof y === "string" ? x.localeCompare(y, undefined, { sensitivity: "base" }) : x < y ? -1 : 1)
  })
}

export function setSort(q: URLSearchParams, s: Sort<string>) {
  if (!s.sort) return
  q.set("sort", s.sort)
  if (s.dir === "desc") q.set("dir", "desc")
}

// Feedback table URL params (?who=, ?fixed=1, ?sort=, ?page=), read the same way on the server and the client. The table
// is one project's, from the route; `project` is set in the key so /api/feedback knows which. `who` is
// always in the key: with no ?who= the table opens on "For me" when there's something to fix, else "Everyone",
// and the client pins that choice into the URL so a later server render keeps the same tab.
export const FEEDBACK_WHO = ["mine", "given", "all"] as const
export const FEEDBACK_SORTS = ["task", "for", "from", "given"] as const
export type FeedbackWho = (typeof FEEDBACK_WHO)[number]

export function readFeedbackParams(params: URLSearchParams, fallback: FeedbackWho) {
  const who = params.get("who")
  return {
    who: FEEDBACK_WHO.includes(who as FeedbackWho) ? (who as FeedbackWho) : fallback,
    projectId: params.get("project") ?? "",
    fixed: params.get("fixed") === "1",
    page: readPage(params),
    ...readSort(params, FEEDBACK_SORTS),
  }
}
export type FeedbackParams = ReturnType<typeof readFeedbackParams>

export function feedbackKey(p: FeedbackParams) {
  const q = new URLSearchParams({ project: p.projectId, who: p.who })
  if (p.fixed) q.set("fixed", "1")
  setSort(q, p)
  if (p.page > 1) q.set("page", String(p.page))
  return q.toString()
}

// Meetings table URL params (?tab=, ?who=all, ?q=, ?sort=, ?page=). Upcoming and "Mine" are the defaults, left out of the key.
export const MEETING_TABS = ["upcoming", "past", "cancelled"] as const
export type MeetingTab = (typeof MEETING_TABS)[number]
export const MEETING_SORTS = ["when", "title"] as const

export function readMeetingParams(params: URLSearchParams) {
  const tab = params.get("tab")
  return {
    tab: MEETING_TABS.includes(tab as MeetingTab) ? (tab as MeetingTab) : "upcoming",
    mine: params.get("who") !== "all",
    q: params.get("q")?.trim().slice(0, 100) ?? "",
    page: readPage(params),
    ...readSort(params, MEETING_SORTS),
  }
}
export type MeetingParams = ReturnType<typeof readMeetingParams>

export function meetingsKey(p: MeetingParams) {
  const q = new URLSearchParams()
  if (p.tab !== "upcoming") q.set("tab", p.tab)
  if (!p.mine) q.set("who", "all")
  if (p.q) q.set("q", p.q)
  setSort(q, p)
  if (p.page > 1) q.set("page", String(p.page))
  return q.toString()
}
