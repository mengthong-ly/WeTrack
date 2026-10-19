import type { Metadata } from "next"
import { Suspense } from "react"

import { Reveal } from "@/components/motion-bits"
import { TaskBrowser } from "@/components/task-browser"
import { listProjects, listTasks } from "@/lib/queries"
import { todayISO } from "@/lib/schedule"
import { requireMember } from "@/lib/session"
import { byDeadline, toCard } from "@/lib/task-view"

export const metadata: Metadata = { title: "Tasks" }

// Loads every task once; view/project filters run in TaskBrowser on the client so switching
// tabs never re-renders this page on the server.
export default async function TasksPage() {
  const me = await requireMember()
  const today = todayISO()
  const [tasks, projects] = await Promise.all([
    listTasks(me.orgId),
    listProjects(me.orgId),
  ])

  return (
    <Reveal className="flex flex-col gap-6">
      <Suspense>
        <TaskBrowser
          tasks={tasks.sort(byDeadline).map((t) => ({
            ...toCard(t, today),
            projectId: t.projectId,
            assigneeId: t.assigneeId,
            completedAt: t.completedAt?.getTime() ?? null,
          }))}
          projects={projects.map(({ id, name, color }) => ({
            id,
            name,
            color,
          }))}
          meId={me.user.id}
          today={today}
        />
      </Suspense>
    </Reveal>
  )
}
