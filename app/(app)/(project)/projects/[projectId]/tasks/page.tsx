import type { Metadata } from "next"
import { Suspense } from "react"

import { Reveal } from "@/components/motion-bits"
import { TaskBrowser } from "@/components/task-browser"
import { PAGE_SIZE, pageOffset, toSearchParams } from "@/lib/paging"
import { listMembers, pageTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { toBrowserTask } from "@/lib/task-view"
import { paramsKey, readParams } from "@/lib/task-views"

export const metadata: Metadata = { title: "Tasks" }

// One project's tasks, rendered for the filters in the URL (search, person, status, view, ?page=, the calendar's
// month). After that TaskBrowser changes the URL without a navigation and fetches /api/tasks for the new rows.
export default async function TasksPage({ params, searchParams }: PageProps<"/projects/[projectId]/tasks">) {
  const me = await requireMember()
  const today = todayISO()
  const { projectId } = await params
  const p = { ...readParams(toSearchParams(await searchParams), me.user.id), projectId }
  const [page, members] = await Promise.all([pageTasks(me.orgId, p, today, pageOffset(p.page), PAGE_SIZE), listMembers(me.orgId)])

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <TaskBrowser
          initial={{ key: paramsKey(p), rows: page.rows.map((t) => toBrowserTask(t, today)), total: page.total }}
          projectId={projectId}
          members={members.map(({ id, name, image }) => ({ id, name, image }))}
          meId={me.user.id}
          today={today}
        />
      </Suspense>
    </Reveal>
  )
}
