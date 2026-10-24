import { readFeedbackParams } from "@/lib/paging"
import { feedbackPage } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// The Feedback board's rows when its URL changes on the client (tab, Open / Fixed, Load more).
// ?offset= asks only for the rows after the ones already on screen.
export async function GET(req: Request) {
  const me = await requireMember()
  const search = new URL(req.url).searchParams
  const p = readFeedbackParams(search, "all")
  const offset = Math.min(Math.max(0, Math.floor(Number(search.get("offset"))) || 0), p.show)
  const page = await feedbackPage(me, p.who, p.fixed, offset, p.show - offset)
  return Response.json(page, { headers: { "Cache-Control": "private, no-store" } })
}
