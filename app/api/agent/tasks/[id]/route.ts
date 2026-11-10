import { updateTask } from "@/app/actions"
import { asAgent, fromResult } from "@/lib/agent"

// Changes some of a task's fields (status, progress, deadline, …), with the same checks as the task page.
export async function PATCH(req: Request, ctx: RouteContext<"/api/agent/tasks/[id]">) {
  return asAgent(req, async () => {
    const body = await req.json().catch(() => undefined)
    if (body === undefined) return fromResult({ error: "Invalid JSON." })
    return fromResult(await updateTask((await ctx.params).id, body))
  })
}
