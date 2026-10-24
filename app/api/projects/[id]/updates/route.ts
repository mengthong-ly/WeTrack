import { clientUpdates } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// Older client updates for a project, newest first from ?offset= (the page already shows the latest ones).
export async function GET(req: Request, ctx: RouteContext<"/api/projects/[id]/updates">) {
  const me = await requireMember()
  const { id } = await ctx.params
  const offset = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("offset"))) || 0)
  return Response.json(await clientUpdates(me.orgId, id, offset), { headers: { "Cache-Control": "private, no-store" } })
}
