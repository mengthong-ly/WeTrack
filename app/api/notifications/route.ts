import { inbox } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// The bell's data: the newest page and the unread count (polled while the tab is visible), or with
// ?before=<ISO time> the page after that ("Show older").
export async function GET(req: Request) {
  const me = await requireMember()
  const before = new Date(new URL(req.url).searchParams.get("before") ?? "")
  const page = await inbox(me.user.id, isNaN(before.getTime()) ? undefined : before)
  return Response.json(page, { headers: { "Cache-Control": "private, no-store" } })
}
