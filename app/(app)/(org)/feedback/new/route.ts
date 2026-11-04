import { redirect } from "next/navigation"

import { getTask } from "@/lib/queries"
import { feedbackHref } from "@/lib/routes"
import { requireMember } from "@/lib/session"

// Old Give feedback links: with ?task= it opens in that task's project; without, pick a project first.
export async function GET(req: Request) {
  const taskId = new URL(req.url).searchParams.get("task")
  const me = await requireMember()
  const task = taskId ? await getTask(me.orgId, taskId) : undefined
  redirect(task ? `${feedbackHref(task.projectId)}/new?task=${task.id}` : "/projects")
}
