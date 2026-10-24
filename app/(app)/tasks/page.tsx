import type { Metadata } from "next"
import { Suspense } from "react"

import { Reveal } from "@/components/motion-bits"
import { TaskBrowser } from "@/components/task-browser"
import { toSearchParams } from "@/lib/paging"
import { listMembers, listProjects, pageTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toBrowserTask } from "@/lib/task-view"
import { paramsKey, readParams } from "@/lib/task-views"

export const metadata: Metadata = { title: "Tasks" }

// Renders the page of tasks the URL asks for (filters, search, ?show=, the calendar's month), filtered in the
// database. After that TaskBrowser changes the URL without a navigation and fetches /api/tasks for the new rows.
export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const me = await requireMember()
  const today = todayISO()
  const p = readParams(toSearchParams(await searchParams), me.user.id)
  const [page, projects, members] = await Promise.all([
    pageTasks(me.orgId, p, today, 0, p.show),
    listProjects(me.orgId),
    listMembers(me.orgId),
  ])

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <TaskBrowser
          initial={{ key: paramsKey(p), rows: page.rows.map((t) => toBrowserTask(t, today)), total: page.total }}
          projects={projects.map(({ id, name, color }) => ({ id, name, color }))}
          members={members.map(({ id, name, image }) => ({ id, name, image }))}
          meId={me.user.id}
          today={today}
        />
      </Suspense>
    </Reveal>
  )
}
