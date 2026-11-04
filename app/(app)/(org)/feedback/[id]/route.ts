import { redirect } from "next/navigation"

import { getFeedback } from "@/lib/queries"
import { feedbackHref } from "@/lib/routes"
import { requireMember } from "@/lib/session"

// Old /feedback/<id> links (notifications, the service worker) open the point inside its project. A point from
// before projects that named no task has none, and goes to project selection.
export async function GET(_req: Request, { params }: RouteContext<"/feedback/[id]">) {
  const me = await requireMember()
  const { id } = await params
  const item = await getFeedback(me, id)
  redirect(item?.projectId ? feedbackHref(item.projectId, item.id) : "/projects")
}
