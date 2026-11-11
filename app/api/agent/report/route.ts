import { asAgent, fromResult } from "@/lib/agent"
import { agentReport } from "@/lib/agent-ops"
import { requireMember } from "@/lib/session"

// The workspace at a glance for an API key (?project= scopes it to one project).
export async function GET(req: Request) {
  return asAgent(req, async () => {
    const r = await agentReport(await requireMember(), new URL(req.url).searchParams.get("project") || undefined)
    return "error" in r ? fromResult(r) : fromResult({}, r)
  })
}
