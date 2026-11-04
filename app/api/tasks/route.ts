import { PAGE_SIZE, pageOffset } from "@/lib/paging"
import { pageTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toBrowserTask } from "@/lib/task-view"
import { readParams } from "@/lib/task-views"

// The Tasks page's rows when its URL changes on the client (filters, search, ?page=, the calendar's month).
// Same params as the page.
export async function GET(req: Request) {
  const me = await requireMember()
  const search = new URL(req.url).searchParams
  const p = readParams(search, me.user.id)
  const today = todayISO()
  const { rows, total } = await pageTasks(me.orgId, p, today, pageOffset(p.page), PAGE_SIZE)
  return Response.json({ rows: rows.map((t) => toBrowserTask(t, today)), total }, { headers: { "Cache-Control": "private, no-store" } })
}
