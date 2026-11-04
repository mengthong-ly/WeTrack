import { redirect } from "next/navigation"

import { tasksHref } from "@/lib/routes"

// Old flat Tasks links: ?project= opens that project's tasks with the other filters kept; anything else goes to
// project selection, since tasks are only listed inside a project now.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const projectId = q.get("project")
  q.delete("project")
  redirect(projectId ? tasksHref(projectId, q.toString()) : "/projects")
}
