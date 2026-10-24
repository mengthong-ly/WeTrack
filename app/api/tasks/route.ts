import { pageTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toBrowserTask } from "@/lib/task-view"
import { readParams } from "@/lib/task-views"

// The Tasks page's rows when its URL changes on the client (filters, search, Load more, the calendar's month).
// Same params as the page; ?offset= asks only for the rows after the ones already on screen.
export async function GET(req: Request) {
  const me = await requireMember()
  const search = new URL(req.url).searchParams
  const p = readParams(search, me.user.id)
  const offset = Math.min(Math.max(0, Math.floor(Number(search.get("offset"))) || 0), p.show)
  const today = todayISO()
  const { rows, total } = await pageTasks(me.orgId, p, today, offset, p.show - offset)
  return Response.json({ rows: rows.map((t) => toBrowserTask(t, today)), total }, { headers: { "Cache-Control": "private, no-store" } })
}
