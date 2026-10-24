import { taskComments } from "@/lib/queries"
import { requireMember } from "@/lib/session"

// Earlier comments on a task, newest first from ?offset= (the task page already shows the latest ones).
export async function GET(req: Request, ctx: RouteContext<"/api/tasks/[id]/comments">) {
  const me = await requireMember()
  const { id } = await ctx.params
  const offset = Math.max(0, Math.floor(Number(new URL(req.url).searchParams.get("offset"))) || 0)
  return Response.json(await taskComments(me.orgId, id, offset), { headers: { "Cache-Control": "private, no-store" } })
}
