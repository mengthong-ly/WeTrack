import { meetingsKey, PAGE_SIZE, pageOffset, readMeetingParams } from "@/lib/paging"
import { listMembers, meetingItems, meetingsPage } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// The Meetings table's rows when its URL changes on the client (tab, Mine / Everyone, search, ?page=).
export async function GET(req: Request) {
  const me = await requireMember()
  const p = readMeetingParams(new URL(req.url).searchParams)
  const [page, members] = await Promise.all([
    meetingsPage(me.orgId, p, { email: me.user.email, userId: me.user.id }, pageOffset(p.page), PAGE_SIZE),
    listMembers(me.orgId),
  ])
  const rows = meetingItems(page.rows, members, { userId: me.user.id, email: me.user.email, role: me.role })
  return Response.json({ key: meetingsKey(p), rows, total: page.total }, { headers: { "Cache-Control": "private, no-store" } })
}
