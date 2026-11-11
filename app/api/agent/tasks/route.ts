import { createTask } from "@/app/actions"
import { asAgent, fromResult } from "@/lib/agent"
import { agentTasks } from "@/lib/agent-ops"
import { requireMember } from "@/lib/session"

// Tasks for an API key: ?q= (title contains), ?status=, ?project=, ?assignee= (a user id, or "me").
export async function GET(req: Request) {
  return asAgent(req, async () => {
    const p = new URL(req.url).searchParams
    const get = (k: string) => p.get(k) || undefined
    const f = { q: get("q"), status: get("status"), project: get("project"), assignee: get("assignee") }
    return fromResult({}, await agentTasks(await requireMember(), f))
  })
}

// A new task, with the same fields and checks as the New task form.
export async function POST(req: Request) {
  return asAgent(req, async () => {
    const body = await req.json().catch(() => undefined)
    if (body === undefined) return fromResult({ error: "Invalid JSON." })
    const r = await createTask(body)
    return fromResult(r, { id: r.id })
  })
}
