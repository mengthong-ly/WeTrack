import { PAGE_SIZE, pageOffset, readFeedbackParams } from "@/lib/paging"
import { feedbackPage } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// The Feedback table's rows when its URL changes on the client (tab, Open / Fixed, ?page=).
export async function GET(req: Request) {
  const me = await requireMember()
  const search = new URL(req.url).searchParams
  const p = readFeedbackParams(search, "all")
  if (!p.projectId) return Response.json({ error: "Pick a project." }, { status: 400 })
  const page = await feedbackPage(me, p.projectId, p.who, p.fixed, pageOffset(p.page), PAGE_SIZE, p)
  return Response.json(page, { headers: { "Cache-Control": "private, no-store" } })
}
