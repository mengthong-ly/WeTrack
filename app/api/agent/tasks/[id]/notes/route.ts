import { addComment } from "@/app/actions"
import { asAgent, fromResult } from "@/lib/agent"

// A progress note on a task: { body }. It is a comment, so it notifies like one.
export async function POST(req: Request, ctx: RouteContext<"/api/agent/tasks/[id]/notes">) {
  return asAgent(req, async () => {
    const body = await req.json().catch(() => undefined)
    if (body === undefined) return fromResult({ error: "Invalid JSON." })
    return fromResult(await addComment((await ctx.params).id, body?.body))
  })
}
