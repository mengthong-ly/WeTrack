import { redirect } from "next/navigation"

import { getTask } from "@/lib/queries"
import { taskHref } from "@/lib/routes"
import { requireMember } from "@/lib/session"

// Old /tasks/<id> links (notifications, emails, Slack, the service worker) open the task inside its project.
export async function GET(_req: Request, { params }: RouteContext<"/tasks/[id]">) {
  const me = await requireMember()
  const { id } = await params
  const task = await getTask(me.orgId, id)
  redirect(task ? taskHref(task.projectId, task.id) : "/projects")
}
