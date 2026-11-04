import { redirect } from "next/navigation"

import { newTaskHref } from "@/lib/routes"

// Old New task links: with ?projectId= it opens there (other presets kept); without, pick a project first.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const projectId = q.get("projectId")
  if (!projectId) redirect("/projects")
  redirect(newTaskHref(projectId, Object.fromEntries(q)))
}
